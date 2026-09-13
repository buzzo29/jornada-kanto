/**
 * Firestore em memória, só com o que as Cloud Functions da lista de amigos usam:
 * collection/doc encadeados, get/set/delete, where+limit, batch e FieldValue.increment.
 *
 * NÃO é um emulador. Não valida regras, não tem índice composto, não simula concorrência.
 * Serve pra uma coisa só: rodar a MÁQUINA DE ESTADOS da amizade (pedir → aceitar → desafiar →
 * batalhar) de ponta a ponta e ver em que estado o banco ficou. É onde os erros desse tipo de
 * feature moram -- amizade gravada de um lado só, pedido que sobrevive ao aceite, desafio que
 * fica pendurado depois de recusado -- e nenhum deles aparece num teste de tela.
 */
const INCREMENT = Symbol('increment');
const DELETE = Symbol('delete');
const store = new Map();   // 'caminho/do/doc' -> objeto
let filaDeTransacoes = Promise.resolve();   // ver runTransaction

function pathOf(parts){ return parts.join('/'); }
function clone(o){ return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

function ehMapaSimples(v){
  return v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && v.__op === undefined;
}
function aplicar(alvo, patch, merge){
  const base = merge ? Object.assign({}, alvo || {}) : {};
  for(const [k, v] of Object.entries(patch)){
    if(v && typeof v === 'object' && v.__op === DELETE){
      delete base[k];
    } else if(v && typeof v === 'object' && v.__op === INCREMENT){
      base[k] = (typeof base[k] === 'number' ? base[k] : 0) + v.n;
    } else if(merge && ehMapaSimples(v)){
      /* MAPA DENTRO DE MAPA. O Firestore de verdade MESCLA mapa aninhado num set({merge:true}) e
         resolve increment la dentro -- e assim que o inventario da mochila e escrito
         (set({ inventario: { potion: increment(1) } })). Sem isto o fake guardava o proprio objeto
         do increment no lugar do numero, e a funcao passava aqui e quebrava so em producao. */
      base[k] = aplicar(base[k], v, true);
    } else {
      base[k] = clone(v);
    }
  }
  return base;
}

/* {'a.b': v} vira {a: {b: v}}, que e o que o update() do Firestore faz com dot notation. Monta
   mapa aninhado pra o aplicar() mesclar com o que ja existe, em vez de trocar o mapa inteiro. */
function expandirPontos(patch){
  const out = {};
  for(const [k, v] of Object.entries(patch)){
    if(k.indexOf('.') < 0){ out[k] = v; continue; }
    const partes = k.split('.');
    let no = out;
    for(let i = 0; i < partes.length - 1; i++){
      if(!ehMapaSimples(no[partes[i]])) no[partes[i]] = {};
      no = no[partes[i]];
    }
    no[partes[partes.length - 1]] = v;
  }
  return out;
}

function docRef(parts){
  const caminho = pathOf(parts);
  return {
    id: parts[parts.length - 1],
    path: caminho,
    collection(nome){ return collRef(parts.concat([nome])); },
    async get(){
      const d = store.get(caminho);
      return { exists: d !== undefined, id: parts[parts.length-1], ref: docRef(parts), data(){ return clone(d); } };
    },
    async set(patch, opts){ store.set(caminho, aplicar(store.get(caminho), patch, !!(opts && opts.merge))); },
    async update(patch){
      if(!store.has(caminho)) throw new Error('NOT_FOUND: ' + caminho);
      store.set(caminho, aplicar(store.get(caminho), expandirPontos(patch), true));
    },
    async delete(){ store.delete(caminho); }
  };
}

/* ⚠️ ORDENAR PELO ID DO DOCUMENTO e o que o Firestore chama de FieldPath.documentId() -- ele nao e
   um campo dos dados, e a paginacao por cursor de uma colecao inteira depende dele (e a unica ordem
   que nao precisa de indice nem de um campo que TODO documento tenha). Aqui ele e uma marca. */
const DOC_ID = { __documentId: true };
function collRef(parts, filtros, limite, ordem, depoisDe){
  filtros = filtros || [];
  const prefixo = pathOf(parts) + '/';
  return {
    doc(id){ return docRef(parts.concat([id])); },
    where(campo, op, valor){ return collRef(parts, filtros.concat([[campo, op, valor]]), limite, ordem, depoisDe); },
    /* ORDENA DE VERDADE. Era um no-op que so devolvia a colecao: um teste de ranking passava sem
       nunca conferir a ordem, e o limit(10) cortava dez QUALQUER em vez dos dez primeiros. */
    orderBy(campo, dir){ return collRef(parts, filtros, limite, [campo, dir === 'desc' ? -1 : 1], depoisDe); },
    limit(n){ return collRef(parts, filtros, n, ordem, depoisDe); },
    /* PAGINACAO POR CURSOR. Sem ela, uma funcao paginada passava no teste lendo sempre a PRIMEIRA
       pagina -- o `startAfter` era ignorado e o teste da segunda pagina via a mesma coisa da
       primeira, o que se le como "funciona". */
    startAfter(v){ return collRef(parts, filtros, limite, ordem, v); },
    async get(){
      let docs = [];
      for(const [caminho, dados] of store){
        // só filhos DIRETOS: 'users/u1/friends/u2' pertence a users/u1/friends, não a users
        if(!caminho.startsWith(prefixo)) continue;
        if(caminho.slice(prefixo.length).includes('/')) continue;
        const id = caminho.slice(prefixo.length);
        const ok = filtros.every(([campo, op, valor])=>{
          const v = dados[campo];
          if(op === '==') return v === valor;
          if(op === '>=') return v !== undefined && v >= valor;
          if(op === '<=') return v !== undefined && v <= valor;
          if(op === '>')  return v !== undefined && v > valor;
          /* O 'in' do Firestore (ate 30 valores). Sem ele, uma consulta que o usa caia no catch do
             codigo testado e o teste dava verde sem cobrir nada -- foi o caso dos ginasios liderados
             no painel de treinadores. */
          if(op === 'in') return Array.isArray(valor) && valor.indexOf(v) >= 0;
          return true;
        });
        if(ok) docs.push({ id, bruto: dados, ref: docRef(parts.concat([id])), data(){ return clone(dados); }, exists:true });
      }
      if(ordem){
        const [campo, dir] = ordem;
        const valor = d => (campo && campo.__documentId) ? d.id : d.bruto[campo];
        docs.sort((a,b)=>{
          const x = valor(a), y = valor(b);
          if(x === y) return a.id < b.id ? -1 : 1;      // desempate estável, como o Firestore (pelo id)
          if(x === undefined) return 1;
          if(y === undefined) return -1;
          return (x < y ? -1 : 1) * dir;
        });
        /* O CURSOR CORTA DEPOIS DA ORDENACAO e ANTES do limite -- essa ordem e a coisa toda: cortando
           depois do limite, a segunda pagina viria vazia sempre que a primeira estivesse cheia. */
        if(depoisDe !== undefined && depoisDe !== null){
          const i = docs.findIndex(d => valor(d) === depoisDe);
          if(i >= 0) docs = docs.slice(i + 1);
        }
      }
      if(limite) docs = docs.slice(0, limite);
      // forEach existe no QuerySnapshot de verdade e o código de produção usa (startTrainerTowerRun)
      return { docs, size: docs.length, empty: docs.length === 0,
               forEach(fn){ docs.forEach(fn); } };
    }
  };
}

function makeDb(){
  return {
    collection(nome){ return collRef([nome]); },
    /* getAll: le varios documentos de uma vez. O Firestore de verdade tem, e o servidor usa pra
       checar a espera de todos os pokemon de um time numa ida so -- seis leituras soltas seriam
       seis idas de rede. Aqui e so um map, mas sem ele o teste morre com "db.getAll is not a
       function" num ponto que nao tem nada a ver com o que estava sendo testado. */
    async getAll(...refs){ return Promise.all(refs.map(r => r.get())); },
    batch(){
      const ops = [];
      return {
        set(ref, patch, opts){ ops.push(()=>ref.set(patch, opts)); return this; },
        delete(ref){ ops.push(()=>ref.delete()); return this; },
        update(ref, patch){ ops.push(()=>ref.update(patch)); return this; },
        async commit(){ for(const op of ops) await op(); }
      };
    },
    /* Transações SERIALIZADAS -- uma de cada vez, na fila.
       Antes rodavam soltas, e o comentário aqui dizia que nenhum caminho testado precisava de
       isolamento. O Boss de Domingo precisa: a raide é global e duas investidas simultâneas leem
       o mesmo HP; sem serializar, a segunda grava por cima da primeira e metade do dano some.
       Não é o algoritmo do Firestore (não há retry por conflito), mas reproduz o que importa:
       quem entra depois enxerga o que o anterior gravou. */
    async runTransaction(fn){
      const minhaVez = filaDeTransacoes;
      let liberar;
      filaDeTransacoes = new Promise(r => { liberar = r; });
      await minhaVez;
      /* LEITURA DEPOIS DE ESCRITA e proibida no Firestore de verdade, e o fake precisa recusar
         igual: sem isso um `tx.get` depois de um `tx.set` passa aqui e so quebra em producao,
         onde chega no cliente como um INTERNAL seco. Foi exatamente o que aconteceu com o
         fightSundayBoss -- 24 checagens verdes aqui, 500 no ar. */
      let jaEscreveu = false;
      try{
        return await fn({
          get: (ref)=>{
            if(jaEscreveu) throw new Error('Firestore transactions require all reads to be executed before all writes.');
            return ref.get();
          },
          /* getAll DENTRO da transacao: o Transaction do Firestore tem, e sem ele aqui qualquer
             funcao que leia dois documentos de uma vez morre com "tx.getAll is not a function" --
             um erro do harness, nao do codigo testado. Passa pela MESMA trava de leitura depois
             de escrita. */
          getAll: (...refs)=>{
            if(jaEscreveu) throw new Error('Firestore transactions require all reads to be executed before all writes.');
            return Promise.all(refs.map(r => r.get()));
          },
          set: (ref, v, o)=>{ jaEscreveu = true; ref.set(v, o); },
          /* update DENTRO da transacao. O Transaction do Firestore tem, e o unequipItem usa: ele
             precisa apagar UMA chave do mapa de equipados sem reescrever o mapa inteiro (duas abas
             tirando itens de pokemon diferentes se atropelariam). Igual ao de fora, ele RECUSA
             documento que nao existe -- que e o que o Firestore de verdade faz. */
          update: (ref, v)=>{ jaEscreveu = true; return ref.update(v); },
          delete: (ref)=>{ jaEscreveu = true; ref.delete(); }
        });
      } finally { liberar(); }
    }
  };
}

/* O FieldPath do Admin SDK -- so o documentId() e usado hoje (a paginacao do painel). */
const FieldPath = { documentId(){ return DOC_ID; } };
const FieldValue = {
  increment: (n)=>({ __op: INCREMENT, n }),
  delete: ()=>({ __op: DELETE })
};

module.exports = {
  makeDb, FieldValue, FieldPath, store,
  reset(){ store.clear(); },
  dump(){ return Object.fromEntries([...store.entries()].map(([k,v])=>[k, clone(v)])); }
};

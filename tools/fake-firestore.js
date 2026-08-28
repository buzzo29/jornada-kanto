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
const store = new Map();   // 'caminho/do/doc' -> objeto

function pathOf(parts){ return parts.join('/'); }
function clone(o){ return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

function aplicar(alvo, patch, merge){
  const base = merge ? Object.assign({}, alvo || {}) : {};
  for(const [k, v] of Object.entries(patch)){
    if(v && typeof v === 'object' && v.__op === INCREMENT){
      base[k] = (typeof base[k] === 'number' ? base[k] : 0) + v.n;
    } else {
      base[k] = clone(v);
    }
  }
  return base;
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
      store.set(caminho, aplicar(store.get(caminho), patch, true));
    },
    async delete(){ store.delete(caminho); }
  };
}

function collRef(parts, filtros, limite){
  filtros = filtros || [];
  const prefixo = pathOf(parts) + '/';
  return {
    doc(id){ return docRef(parts.concat([id])); },
    where(campo, op, valor){ return collRef(parts, filtros.concat([[campo, op, valor]]), limite); },
    orderBy(){ return collRef(parts, filtros, limite); },
    limit(n){ return collRef(parts, filtros, n); },
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
          return true;
        });
        if(ok) docs.push({ id, ref: docRef(parts.concat([id])), data(){ return clone(dados); }, exists:true });
      }
      if(limite) docs = docs.slice(0, limite);
      return { docs, size: docs.length, empty: docs.length === 0 };
    }
  };
}

function makeDb(){
  return {
    collection(nome){ return collRef([nome]); },
    batch(){
      const ops = [];
      return {
        set(ref, patch, opts){ ops.push(()=>ref.set(patch, opts)); return this; },
        delete(ref){ ops.push(()=>ref.delete()); return this; },
        update(ref, patch){ ops.push(()=>ref.update(patch)); return this; },
        async commit(){ for(const op of ops) await op(); }
      };
    },
    /* Transação sem isolamento nenhum: as funções de amizade não dependem de retry, e o único
       caminho que realmente precisa dele (a criação de batalha) não é exercitado aqui. */
    async runTransaction(fn){
      return await fn({
        get: (ref)=>ref.get(),
        set: (ref, v, o)=>{ ref.set(v, o); },
        delete: (ref)=>{ ref.delete(); }
      });
    }
  };
}

const FieldValue = { increment: (n)=>({ __op: INCREMENT, n }) };

module.exports = {
  makeDb, FieldValue, store,
  reset(){ store.clear(); },
  dump(){ return Object.fromEntries([...store.entries()].map(([k,v])=>[k, clone(v)])); }
};

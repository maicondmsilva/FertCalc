const solver = require('javascript-lp-solver');

const targetN = 5;
const targetP = 17.5;
const targetK = 25;

const materials = [
  { id: 'ureia', name: 'Ureia', price: 2500, n: 45, p: 0, k: 0 },
  { id: 'map', name: 'MAP', price: 3200, n: 11, p: 52, k: 0 },
  { id: 'kcl', name: 'KCL', price: 2800, n: 0, p: 0, k: 60 },
  { id: 'fertigran', name: 'Fertigran Base', price: 1000, n: 0, p: 0, k: 0, s: 10, ca: 10 },
];

const model = {
  optimize: "cost",
  opType: "min",
  constraints: {
    n_eq: { min: targetN, max: targetN + 0.1 },
    p_eq: { min: targetP, max: targetP + 0.1 },
    k_eq: { min: targetK, max: targetK + 0.1 },
  },
  variables: {},
  ints: {}
};

materials.forEach(m => {
  model.variables[m.id] = {
    cost: m.price / 1000, // cost per kg
    n_eq: m.n / 100,
    p_eq: m.p / 100,
    k_eq: m.k / 100,
    weight: 1
  };
});

// Force 5 kg of Fertigran Base as an example
model.constraints.fertigran_eq = { equal: 5 };
model.variables['fertigran'].fertigran_eq = 1;

const result = solver.Solve(model);
console.log(result);

let totalWeight = 0;
materials.forEach(m => {
  if (result[m.id]) {
    console.log(`${m.name}: ${result[m.id].toFixed(2)} kg`);
    totalWeight += result[m.id];
  }
});

console.log(`\nNew Dose: ${totalWeight.toFixed(2)} kg/ha`);

const formulaN = (targetN / totalWeight) * 100;
const formulaP = (targetP / totalWeight) * 100;
const formulaK = (targetK / totalWeight) * 100;

console.log(`Formula: ${formulaN.toFixed(1)}-${formulaP.toFixed(1)}-${formulaK.toFixed(1)}`);

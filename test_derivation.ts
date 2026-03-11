import { formatNPK } from './src/utils/formatters';

const originalN = 5;
const originalP = 25;
const originalK = 25;

const hectares = 200;
const dose = 100;

const reductionN = 0;
const reductionP = 30; // 30% reduction on P
const reductionK = 0;

const originalQuantityTons = (hectares * dose) / 1000;

const suppliedN = dose * (originalN / 100);
const suppliedP = dose * (originalP / 100);
const suppliedK = dose * (originalK / 100);

const targetN = suppliedN * (1 - reductionN / 100);
const targetP = suppliedP * (1 - reductionP / 100);
const targetK = suppliedK * (1 - reductionK / 100);

console.log(`Original: ${originalN}-${originalP}-${originalK}. Dose: ${dose}kg/ha. Area: ${hectares}ha. Vol: ${originalQuantityTons} tons.`);
console.log(`Fornecido Original: N=${suppliedN} P=${suppliedP} K=${suppliedK} kg/ha`);
console.log(`Desejado (-30% P): N=${targetN} P=${targetP} K=${targetK} kg/ha`);

console.log("\nSimulated Fertigran P Formula: 04-20-20");
const selectedFormula = { npk_n: 4, npk_p: 20, npk_k: 20 };

let newDose = 0;
if (targetP > 0 && selectedFormula.npk_p > 0) {
  newDose = targetP / (selectedFormula.npk_p / 100);
}

const newQuantityTons = (newDose * hectares) / 1000;
const simulatedProvidedN = newDose * (selectedFormula.npk_n / 100);
const simulatedProvidedP = newDose * (selectedFormula.npk_p / 100);
const simulatedProvidedK = newDose * (selectedFormula.npk_k / 100);

console.log(`Nova dose necessária para atingir ${targetP}kg de P com a fórmula 04-20-20: ${newDose} kg/ha`);
console.log(`Novo volume total a comprar: ${newQuantityTons} tons.`);
console.log(`Fornecimento real com a nova dose: N=${simulatedProvidedN} P=${simulatedProvidedP} K=${simulatedProvidedK} kg/ha`);
console.log(`Redução de Adubo Logístico: ${originalQuantityTons - newQuantityTons} tons`);

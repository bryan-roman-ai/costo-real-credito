/**
 * Suite de pruebas unitarias para "Costo Real del Crédito"
 * Ejecución: node tests.js
 * Verifica con casos calculados a mano las 3 calculadoras y el generador SVG.
 * Termina con código de salida 1 si alguna verificación falla.
 */

'use strict';

const {
  calculateFrenchAmortization,
  simulateMinimumPayment,
  compareZeroInterestVsCashDiscount,
  buildMinimumPaymentSvg
} = require('./app.js');

let passed = 0;
let failed = 0;

function assertClose(actual, expected, tolerance, description) {
  const diff = Math.abs(actual - expected);
  if (Number.isFinite(actual) && diff <= tolerance) {
    console.log(`  [PASS] ${description} -> obtenido: ${actual.toFixed(4)}, esperado: ${expected.toFixed(4)} (tol: ±${tolerance})`);
    passed++;
  } else {
    console.error(`  [FAIL] ${description} -> obtenido: ${actual}, esperado: ${expected} (diferencia: ${diff}, tol: ±${tolerance})`);
    failed++;
  }
}

function assertEqual(actual, expected, description) {
  if (actual === expected) {
    console.log(`  [PASS] ${description} -> ${actual}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${description} -> obtenido: ${actual}, esperado: ${expected}`);
    failed++;
  }
}

function assertThrows(fn, description) {
  try {
    fn();
    console.error(`  [FAIL] ${description} -> no lanzó excepción`);
    failed++;
  } catch (err) {
    console.log(`  [PASS] ${description} -> lanzó: "${err.message}"`);
    passed++;
  }
}

console.log('==============================================================');
console.log(' Ejecutando pruebas matemáticas: Costo Real del Crédito');
console.log('==============================================================\n');

// ---------------------------------------------------------------------------
// 1. Pruebas de Calculadora 1: Sistema Francés
// ---------------------------------------------------------------------------
console.log('1) Calculadora 1: Compra a N cuotas (Sistema Francés)');

{
  // Caso obligatorio enunciado: $1000 a 12 cuotas al 24% nominal anual (2% mensual)
  // C = 1000 * [0.02 * (1.02)^12] / [(1.02)^12 - 1] = 94.5595966... -> 94.56
  // Total pagado = 94.5595966 * 12 = 1134.715 -> 1134.72
  // Intereses totales = 134.715 -> 134.72
  // TEA = (1.02)^12 - 1 = 26.824179% -> 26.82%
  const r1 = calculateFrenchAmortization({
    principal: 1000,
    months: 12,
    annualNominalRatePct: 24
  });

  assertClose(r1.monthlyPayment, 94.56, 0.01, 'Caso $1000 a 12 meses al 24% TNA -> Cuota mensual = $94.56');
  assertClose(r1.totalPaid, 1134.72, 0.02, 'Caso $1000 a 12 meses al 24% TNA -> Total pagado = $1134.72');
  assertClose(r1.totalInterest, 134.72, 0.02, 'Caso $1000 a 12 meses al 24% TNA -> Intereses totales = $134.72');
  assertClose(r1.effectiveAnnualRatePct, 26.8242, 0.01, 'Caso 24% TNA capitalización mensual -> TEA = 26.82%');
  assertEqual(r1.schedule.length, 12, 'La tabla de amortización tiene exactamente 12 filas');
  assertClose(r1.schedule[0].interest, 20.00, 0.01, 'Mes 1 interés = $1000 * 2% = $20.00');
  assertClose(r1.schedule[0].principal, 74.56, 0.01, 'Mes 1 abono a capital = $94.56 - $20.00 = $74.56');
  assertClose(r1.schedule[11].endingBalance, 0.00, 0.001, 'Mes 12 saldo final queda en $0.00');
}

{
  // Caso tasa 0%: $1200 a 6 meses al 0% TNA -> cuota exacta $200, interés $0, TEA 0%
  const rZero = calculateFrenchAmortization({
    principal: 1200,
    months: 6,
    annualNominalRatePct: 0
  });
  assertClose(rZero.monthlyPayment, 200.00, 0.001, 'Caso 0% TNA ($1200 a 6 meses) -> Cuota = $200.00');
  assertClose(rZero.totalInterest, 0.00, 0.001, 'Caso 0% TNA -> Intereses totales = $0.00');
  assertClose(rZero.effectiveAnnualRatePct, 0.00, 0.001, 'Caso 0% TNA -> TEA = 0.00%');
}

{
  // Caso 1 sola cuota: $500 a 1 mes al 18% TNA (1.5% mensual) -> interés $7.50, cuota $507.50
  const rOne = calculateFrenchAmortization({
    principal: 500,
    months: 1,
    annualNominalRatePct: 18
  });
  assertClose(rOne.monthlyPayment, 507.50, 0.01, 'Caso $500 a 1 cuota al 18% TNA -> Cuota = $507.50');
  assertClose(rOne.totalInterest, 7.50, 0.01, 'Caso $500 a 1 cuota al 18% TNA -> Interés = $7.50');
}

assertThrows(
  () => calculateFrenchAmortization({ principal: -100, months: 12, annualNominalRatePct: 20 }),
  'Valida error cuando el monto es negativo'
);

// ---------------------------------------------------------------------------
// 2. Pruebas de Calculadora 2: Simulador de Pago Mínimo
// ---------------------------------------------------------------------------
console.log('\n2) Calculadora 2: Simulador de Pago Mínimo');

{
  // Caso calculado a mano paso a paso (3 meses):
  // Saldo = $100, TNA = 12% (1% mensual), % mínimo = 50%, piso = $40
  // Mes 1: Interés = 100 * 0.01 = 1.00; Pago mín = max(100*0.5, 40) = 50.00; Abono capital = 49.00; Saldo1 = 51.00
  // Mes 2: Interés = 51 * 0.01 = 0.51; Pago mín = max(51*0.5=25.5, 40) = 40.00; Abono capital = 39.49; Saldo2 = 11.51
  // Mes 3: Interés = 11.51 * 0.01 = 0.1151; Total adeudado = 11.6251 < 40 -> Paga 11.6251 y liquida; Saldo3 = 0
  // Total intereses = 1.00 + 0.51 + 0.1151 = 1.6251 -> 1.63
  const simHand = simulateMinimumPayment({
    balance: 100,
    annualNominalRatePct: 12,
    minPaymentPct: 50,
    minPaymentFloor: 40
  });

  assertEqual(simHand.monthsToPayOff, 3, 'Caso manual $100 (TNA 12%, mín 50%, piso $40) -> se salda en 3 meses');
  assertClose(simHand.totalInterest, 1.63, 0.01, 'Caso manual $100 -> Intereses totales = $1.63');
  assertClose(simHand.totalPaid, 101.63, 0.01, 'Caso manual $100 -> Total pagado = $101.63');
  assertClose(simHand.remainingBalance, 0.00, 0.001, 'Caso manual $100 -> Saldo final = $0.00');
}

{
  // Caso ejemplo por defecto UI: Saldo $1000, TNA 24% (2% mensual), % mínimo 5%, piso $15
  // Mes 1: Interés = $20.00, Pago = $50.00, Abono capital = $30.00, Saldo final = $970.00
  const simDefault = simulateMinimumPayment({
    balance: 1000,
    annualNominalRatePct: 24,
    minPaymentPct: 5,
    minPaymentFloor: 15
  });

  assertEqual(simDefault.nonConvergent, false, 'Caso $1000 (TNA 24%, mín 5%, piso $15) converge correctamente');
  assertClose(simDefault.firstMonthMinPayment, 50.00, 0.01, 'Mes 1 pago mínimo = $50.00');
  assertClose(simDefault.history[1].interest, 20.00, 0.01, 'Mes 1 interés = $20.00');
  assertClose(simDefault.history[1].endingBalance, 970.00, 0.01, 'Mes 1 saldo restante = $970.00');
  assertEqual(simDefault.monthsToPayOff, 66, 'Caso $1000 (TNA 24%, mín 5%, piso $15) toma 66 meses en liquidarse');
  assertClose(simDefault.totalInterest, 553.60, 0.01, 'Caso $1000 (TNA 24%, mín 5%, piso $15) acumula $553.60 de intereses');

  const svg = buildMinimumPaymentSvg(simDefault.history);
  assertEqual(svg.includes('<svg') && svg.includes('<polyline'), true, 'Generador SVG produce elementos <svg> y <polyline> válidos');
}

{
  // Caso trampa de deuda (amortización negativa):
  // Saldo $1000, TNA 36% (3% mensual), pago mínimo 2% ($20) y piso $15 -> Pago ($20) < Interés ($30)
  const simTrap = simulateMinimumPayment({
    balance: 1000,
    annualNominalRatePct: 36,
    minPaymentPct: 2,
    minPaymentFloor: 15
  });
  assertEqual(simTrap.nonConvergent, true, 'Detecta amortización negativa cuando el interés mensual supera al pago mínimo');
}

// ---------------------------------------------------------------------------
// 3. Pruebas de Calculadora 3: Diferido sin intereses vs Descuento de contado
// ---------------------------------------------------------------------------
console.log('\n3) Calculadora 3: Diferido sin intereses vs. Descuento de contado');

{
  // Caso 1: $1000 precio lista, 8% descuento de contado ($920), 12 cuotas sin intereses ($83.3333/mes),
  // tasa de oportunidad anual = 6% (0.5% mensual).
  // VP cuotas = (1000/12) * [1 - (1.005)^(-12)] / 0.005 = 83.333333 * 11.618932 = 968.2443 -> $968.24
  // Como Precio Contado ($920.00) < VP Cuotas ($968.24), conviene CONTADO con ahorro en VP de $48.24.
  const cmp1 = compareZeroInterestVsCashDiscount({
    listPrice: 1000,
    cashDiscountPct: 8,
    months: 12,
    opportunityAnnualRatePct: 6
  });

  assertClose(cmp1.cashPrice, 920.00, 0.01, 'Precio de contado con 8% de descuento sobre $1000 = $920.00');
  assertClose(cmp1.monthlyInstallment, 83.33, 0.01, 'Cuota mensual sin intereses ($1000 / 12) = $83.33');
  assertClose(cmp1.presentValueOfInstallments, 968.24, 0.02, 'Valor Presente de 12 cuotas de $83.33 al 6% TNA (0.5% mensual) = $968.24');
  assertClose(cmp1.netAdvantageOfCashPV, 48.24, 0.02, 'Ventaja en Valor Presente de pagar de contado = $48.24');
  assertEqual(cmp1.recommendation, 'CONTADO', 'Recomendación correcta: CONTADO');
  assertClose(cmp1.implicitEffectiveAnnualPct, 16.86, 0.02, 'TEA implícita de perder 8% de descuento por diferir a 12 meses = 16.86%');
}

{
  // Caso 2: Descuento muy bajo (2% -> contado $980) y costo de oportunidad alto (12% anual -> 1% mensual) en 12 meses.
  // VP cuotas = (1000/12) * [1 - (1.01)^(-12)] / 0.01 = 83.333333 * 11.255077 = 937.923 -> $937.92
  // Como VP cuotas ($937.92) < Precio contado ($980.00), conviene DIFERIDO.
  const cmp2 = compareZeroInterestVsCashDiscount({
    listPrice: 1000,
    cashDiscountPct: 2,
    months: 12,
    opportunityAnnualRatePct: 12
  });

  assertClose(cmp2.cashPrice, 980.00, 0.01, 'Precio de contado con 2% de descuento = $980.00');
  assertClose(cmp2.presentValueOfInstallments, 937.92, 0.02, 'VP de 12 cuotas al 12% TNA (1% mensual) = $937.92');
  assertEqual(cmp2.recommendation, 'DIFERIDO', 'Recomendación correcta cuando el rendimiento supera al descuento: DIFERIDO');
}

// ---------------------------------------------------------------------------
// Resumen final y código de salida
// ---------------------------------------------------------------------------
console.log('\n==============================================================');
console.log(` Resultado final: ${passed} pruebas exitosas, ${failed} fallidas.`);
console.log('==============================================================');

if (failed > 0) {
  process.exit(1);
}
process.exit(0);

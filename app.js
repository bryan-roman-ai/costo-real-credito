/**
 * Costo Real del Crédito — Simulador Educativo (Ecuador / Latam)
 * Lógica de cálculo y control de interfaz (Sin dependencias externas)
 * Autor: Bryan Román (linkedin.com/in/bryan-roman-ai)
 * Herramienta educativa. No es asesoría financiera.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CreditCalculator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Redondea un número a 2 decimales evitando sesgos comunes de punto flotante.
   * @param {number} num
   * @returns {number}
   */
  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calculadora 1: Compra a N cuotas (Sistema de Amortización Francés)
   *
   * Fórmulas:
   * - Tasa periódica mensual (i): TNA / 12
   * - Cuota mensual (C): P * [ i * (1 + i)^n ] / [ (1 + i)^n - 1 ]  (si i > 0; si i = 0, P / n)
   * - Tasa Efectiva Anual (TEA): (1 + i)^12 - 1
   *
   * @param {Object} params
   * @param {number} params.principal - Monto de la compra (P > 0)
   * @param {number} params.months - Número de cuotas mensuales (n >= 1, entero)
   * @param {number} params.annualNominalRatePct - Tasa Nominal Anual en porcentaje (ej. 24 para 24%)
   * @returns {Object} Resultado del cálculo y tabla de amortización
   */
  function calculateFrenchAmortization(params) {
    const P = Number(params.principal);
    const n = Math.floor(Number(params.months));
    const tnaPct = Number(params.annualNominalRatePct);

    if (!Number.isFinite(P) || P <= 0) {
      throw new Error('El monto de la compra debe ser mayor a 0.');
    }
    if (!Number.isFinite(n) || n < 1 || n > 600) {
      throw new Error('El número de cuotas debe ser un entero entre 1 y 600.');
    }
    if (!Number.isFinite(tnaPct) || tnaPct < 0 || tnaPct > 500) {
      throw new Error('La tasa nominal anual debe estar entre 0% y 500%.');
    }

    const monthlyRate = (tnaPct / 100) / 12;
    const effectiveAnnualRatePct = (Math.pow(1 + monthlyRate, 12) - 1) * 100;

    let rawMonthlyPayment;
    if (monthlyRate === 0) {
      rawMonthlyPayment = P / n;
    } else {
      const factor = Math.pow(1 + monthlyRate, n);
      rawMonthlyPayment = P * (monthlyRate * factor) / (factor - 1);
    }

    const monthlyPayment = round2(rawMonthlyPayment);
    const schedule = [];
    let balance = P;
    let totalPaid = 0;
    let totalInterest = 0;

    for (let k = 1; k <= n; k++) {
      const interestPayment = balance * monthlyRate;
      let payment = rawMonthlyPayment;
      let principalPayment = payment - interestPayment;

      if (k === n) {
        principalPayment = balance;
        payment = principalPayment + interestPayment;
      }

      const endingBalance = Math.max(0, balance - principalPayment);

      totalPaid += payment;
      totalInterest += interestPayment;

      schedule.push({
        month: k,
        initialBalance: round2(balance),
        payment: round2(payment),
        interest: round2(interestPayment),
        principal: round2(principalPayment),
        endingBalance: round2(endingBalance)
      });

      balance = endingBalance;
    }

    return {
      principal: round2(P),
      months: n,
      annualNominalRatePct: tnaPct,
      monthlyRatePct: monthlyRate * 100,
      effectiveAnnualRatePct: effectiveAnnualRatePct,
      rawMonthlyPayment: rawMonthlyPayment,
      monthlyPayment: monthlyPayment,
      totalPaid: round2(totalPaid),
      totalInterest: round2(totalInterest),
      interestSharePct: totalPaid > 0 ? (totalInterest / totalPaid) * 100 : 0,
      overcostPct: P > 0 ? (totalInterest / P) * 100 : 0,
      schedule: schedule
    };
  }

  /**
   * Calculadora 2: Simulación de Pago Mínimo vs Pago Fijo / Total
   *
   * Regla de simulación mes a mes:
   * - Cada mes se calcula el interés del período: I_t = Saldo_{t-1} * (TNA / 12)
   * - El pago mínimo requerido del mes se calcula como:
   *   Pago_t = max(Saldo_{t-1} * (minPaymentPct / 100), minFloor)
   *   Si el saldo más intereses (Saldo_{t-1} + I_t) es menor o igual a ese monto,
   *   se paga exactamente Saldo_{t-1} + I_t y la deuda queda saldada.
   * - Si la tasa mensual i >= (minPaymentPct / 100) y el saldo supera el piso mínimo
   *   de modo que el pago no cubre ni siquiera los intereses del mes, la deuda crece
   *   indefinidamente (trampa de deuda / amortización negativa).
   *
   * @param {Object} params
   * @param {number} params.balance - Saldo inicial de la tarjeta (> 0)
   * @param {number} params.annualNominalRatePct - Tasa Nominal Anual en % (>= 0)
   * @param {number} params.minPaymentPct - Porcentaje de pago mínimo mensual sobre el saldo (ej. 5 para 5%)
   * @param {number} [params.minPaymentFloor=15] - Piso mínimo en moneda local cuando el % da un valor muy bajo (ej. $15)
   * @param {number} [params.maxMonths=600] - Límite de meses a simular para evitar bucles infinitos
   * @returns {Object} Resultados de la simulación mes a mes
   */
  function simulateMinimumPayment(params) {
    const initialBalance = Number(params.balance);
    const tnaPct = Number(params.annualNominalRatePct);
    const minPct = Number(params.minPaymentPct);
    const minFloor = params.minPaymentFloor !== undefined ? Number(params.minPaymentFloor) : 15;
    const maxMonths = params.maxMonths !== undefined ? Number(params.maxMonths) : 600;

    if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
      throw new Error('El saldo inicial debe ser mayor a 0.');
    }
    if (!Number.isFinite(tnaPct) || tnaPct < 0 || tnaPct > 500) {
      throw new Error('La tasa nominal anual debe estar entre 0% y 500%.');
    }
    if (!Number.isFinite(minPct) || minPct <= 0 || minPct > 100) {
      throw new Error('El porcentaje de pago mínimo debe estar entre 0.1% y 100%.');
    }
    if (!Number.isFinite(minFloor) || minFloor <= 0) {
      throw new Error('El piso de pago mínimo debe ser mayor a 0.');
    }

    const monthlyRate = (tnaPct / 100) / 12;
    const minRate = minPct / 100;

    let balance = initialBalance;
    let totalInterest = 0;
    let totalPaid = 0;
    let month = 0;
    let nonConvergent = false;

    const history = [
      {
        month: 0,
        initialBalance: round2(initialBalance),
        interest: 0,
        payment: 0,
        principalPaid: 0,
        endingBalance: round2(initialBalance),
        cumulativeInterest: 0
      }
    ];

    while (balance > 0.005 && month < maxMonths) {
      month += 1;
      const interest = balance * monthlyRate;
      const totalOwed = balance + interest;

      let payment = Math.max(balance * minRate, minFloor);
      if (payment >= totalOwed) {
        payment = totalOwed;
      }

      const principalPaid = payment - interest;

      if (principalPaid <= 0) {
        nonConvergent = true;
        const endingBalance = balance + interest - payment;
        totalInterest += interest;
        totalPaid += payment;
        history.push({
          month: month,
          initialBalance: round2(balance),
          interest: round2(interest),
          payment: round2(payment),
          principalPaid: round2(principalPaid),
          endingBalance: round2(endingBalance),
          cumulativeInterest: round2(totalInterest)
        });
        balance = endingBalance;
        break;
      }

      balance = Math.max(0, balance - principalPaid);
      totalInterest += interest;
      totalPaid += payment;

      history.push({
        month: month,
        initialBalance: round2(totalOwed - interest),
        interest: round2(interest),
        payment: round2(payment),
        principalPaid: round2(principalPaid),
        endingBalance: round2(balance),
        cumulativeInterest: round2(totalInterest)
      });
    }

    const hitCap = !nonConvergent && balance > 0.005 && month >= maxMonths;

    return {
      initialBalance: round2(initialBalance),
      annualNominalRatePct: tnaPct,
      monthlyRatePct: monthlyRate * 100,
      minPaymentPct: minPct,
      minPaymentFloor: minFloor,
      firstMonthMinPayment: history.length > 1 ? history[1].payment : round2(initialBalance),
      monthsToPayOff: month,
      yearsToPayOff: round2(month / 12),
      totalPaid: round2(totalPaid),
      totalInterest: round2(totalInterest),
      interestToPrincipalRatioPct: initialBalance > 0 ? (totalInterest / initialBalance) * 100 : 0,
      nonConvergent: nonConvergent,
      hitCap: hitCap,
      remainingBalance: round2(balance),
      history: history
    };
  }

  /**
   * Calculadora 3: Diferido "sin intereses" vs Descuento por pago de contado
   *
   * Fórmulas:
   * - Precio de contado (P_contado): P_lista * (1 - d)
   * - Cuota mensual diferida sin intereses (C): P_lista / n
   * - Tasa de oportunidad mensual (r_m): TNA_oportunidad / 12
   * - Valor Presente de las cuotas (VP):
   *   VP = sum_{t=1..n} [ C / (1 + r_m)^t ] = C * [ 1 - (1 + r_m)^(-n) ] / r_m  (si r_m > 0; si r_m = 0, P_lista)
   * - Tasa implícita mensual (TIR) si renuncias al descuento por diferir:
   *   Resuelve P_contado = sum_{t=1..n} [ C / (1 + tir_m)^t ]
   *
   * @param {Object} params
   * @param {number} params.listPrice - Precio de lista (diferido "sin intereses") (> 0)
   * @param {number} params.cashDiscountPct - % de descuento si se paga de contado (0 a 99)
   * @param {number} params.months - Número de cuotas sin intereses (>= 1)
   * @param {number} params.opportunityAnnualRatePct - Tasa anual de costo de oportunidad / rendimiento alternativo (%)
   * @returns {Object} Comparación detallada en Valor Presente y tasa implícita
   */
  function compareZeroInterestVsCashDiscount(params) {
    const listPrice = Number(params.listPrice);
    const discountPct = Number(params.cashDiscountPct);
    const n = Math.floor(Number(params.months));
    const oppAnnualPct = Number(params.opportunityAnnualRatePct);

    if (!Number.isFinite(listPrice) || listPrice <= 0) {
      throw new Error('El precio de lista debe ser mayor a 0.');
    }
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct >= 100) {
      throw new Error('El descuento de contado debe estar entre 0% y 99.9%.');
    }
    if (!Number.isFinite(n) || n < 1 || n > 600) {
      throw new Error('El número de cuotas debe ser un entero entre 1 y 600.');
    }
    if (!Number.isFinite(oppAnnualPct) || oppAnnualPct < 0 || oppAnnualPct > 500) {
      throw new Error('La tasa de oportunidad anual debe estar entre 0% y 500%.');
    }

    const cashDiscountAmount = listPrice * (discountPct / 100);
    const cashPrice = listPrice - cashDiscountAmount;
    const monthlyInstallment = listPrice / n;
    const monthlyOppRate = (oppAnnualPct / 100) / 12;

    let pvInstallments;
    if (monthlyOppRate === 0) {
      pvInstallments = listPrice;
    } else {
      pvInstallments = monthlyInstallment * (1 - Math.pow(1 + monthlyOppRate, -n)) / monthlyOppRate;
    }

    const flows = [];
    for (let t = 1; t <= n; t++) {
      const df = Math.pow(1 + monthlyOppRate, -t);
      const pvFlow = monthlyInstallment * df;
      flows.push({
        month: t,
        nominalInstallment: round2(monthlyInstallment),
        discountFactor: df,
        presentValue: round2(pvFlow)
      });
    }

    // Cálculo de la tasa implícita mensual por bisección:
    // ¿Qué tasa mensual r hace que VP(cuotas) == cashPrice?
    let implicitMonthlyRate = 0;
    if (discountPct > 0) {
      let low = 0;
      let high = 5.0; // 500% mensual cota superior
      for (let iter = 0; iter < 80; iter++) {
        const mid = (low + high) / 2;
        const pvMid = mid === 0
          ? listPrice
          : monthlyInstallment * (1 - Math.pow(1 + mid, -n)) / mid;
        if (pvMid > cashPrice) {
          low = mid;
        } else {
          high = mid;
        }
      }
      implicitMonthlyRate = (low + high) / 2;
    }

    const implicitNominalAnnualPct = implicitMonthlyRate * 12 * 100;
    const implicitEffectiveAnnualPct = (Math.pow(1 + implicitMonthlyRate, 12) - 1) * 100;

    // Si pvInstallments < cashPrice, diferir es más barato en valor presente
    // Si cashPrice < pvInstallments, pagar de contado con descuento es más barato en valor presente
    const netSavingsCashVsDeferredPV = pvInstallments - cashPrice;
    let recommendation;
    if (Math.abs(netSavingsCashVsDeferredPV) < 0.01) {
      recommendation = 'INDIFERENTE';
    } else if (netSavingsCashVsDeferredPV > 0) {
      recommendation = 'CONTADO';
    } else {
      recommendation = 'DIFERIDO';
    }

    return {
      listPrice: round2(listPrice),
      cashDiscountPct: discountPct,
      cashDiscountAmount: round2(cashDiscountAmount),
      cashPrice: round2(cashPrice),
      months: n,
      monthlyInstallment: round2(monthlyInstallment),
      opportunityAnnualRatePct: oppAnnualPct,
      monthlyOpportunityRatePct: monthlyOppRate * 100,
      presentValueOfInstallments: round2(pvInstallments),
      rawPresentValueOfInstallments: pvInstallments,
      netAdvantageOfCashPV: round2(netSavingsCashVsDeferredPV),
      absSavingsPV: round2(Math.abs(netSavingsCashVsDeferredPV)),
      implicitMonthlyRatePct: implicitMonthlyRate * 100,
      implicitNominalAnnualPct: implicitNominalAnnualPct,
      implicitEffectiveAnnualPct: implicitEffectiveAnnualPct,
      recommendation: recommendation,
      flows: flows
    };
  }

  /**
   * Genera el markup SVG (string) para el gráfico de Saldo vs Tiempo (Calculadora 2).
   * Hecho a mano sin librerías externas, accesible con <title> y <desc>.
   *
   * @param {Array} history - Historial mes a mes de simulateMinimumPayment
   * @param {Object} [options]
   * @returns {string} Código SVG
   */
  function buildMinimumPaymentSvg(history, options) {
    const opts = options || {};
    const width = opts.width || 720;
    const height = opts.height || 320;
    const padLeft = 68;
    const padRight = 24;
    const padTop = 28;
    const padBottom = 46;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    if (!history || history.length < 2) {
      return '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Sin datos suficientes"></svg>';
    }

    const maxMonth = history[history.length - 1].month || 1;
    let maxVal = 0;
    for (let i = 0; i < history.length; i++) {
      if (history[i].endingBalance > maxVal) maxVal = history[i].endingBalance;
      if (history[i].initialBalance > maxVal) maxVal = history[i].initialBalance;
      if (history[i].cumulativeInterest > maxVal) maxVal = history[i].cumulativeInterest;
    }
    if (maxVal <= 0) maxVal = 100;
    const yMax = Math.ceil(maxVal * 1.08);

    function xCoord(m) {
      return padLeft + (m / maxMonth) * plotW;
    }

    function yCoord(v) {
      return padTop + plotH - (v / yMax) * plotH;
    }

    const balancePoints = [];
    const interestPoints = [];

    for (let i = 0; i < history.length; i++) {
      const pt = history[i];
      const x = xCoord(pt.month).toFixed(1);
      const yBal = yCoord(pt.endingBalance).toFixed(1);
      const yInt = yCoord(pt.cumulativeInterest).toFixed(1);
      balancePoints.push(x + ',' + yBal);
      interestPoints.push(x + ',' + yInt);
    }

    const firstX = xCoord(0).toFixed(1);
    const lastX = xCoord(maxMonth).toFixed(1);
    const baseY = yCoord(0).toFixed(1);

    const areaBalancePoints = firstX + ',' + baseY + ' ' + balancePoints.join(' ') + ' ' + lastX + ',' + baseY;

    // Líneas guía horizontales (4 niveles)
    let gridLines = '';
    const ySteps = 4;
    for (let s = 0; s <= ySteps; s++) {
      const val = (yMax / ySteps) * s;
      const y = yCoord(val).toFixed(1);
      const label = '$' + Math.round(val).toLocaleString('es-EC');
      gridLines +=
        '<line x1="' + padLeft + '" y1="' + y + '" x2="' + (width - padRight) + '" y2="' + y + '" class="svg-grid-line" />' +
        '<text x="' + (padLeft - 10) + '" y="' + (Number(y) + 4) + '" text-anchor="end" class="svg-axis-label">' + label + '</text>';
    }

    // Etiquetas eje X (Meses)
    let xLabels = '';
    const xTicks = Math.min(maxMonth, 6);
    for (let t = 0; t <= xTicks; t++) {
      const mVal = Math.round((maxMonth / xTicks) * t);
      const x = xCoord(mVal).toFixed(1);
      xLabels +=
        '<line x1="' + x + '" y1="' + (padTop + plotH) + '" x2="' + x + '" y2="' + (padTop + plotH + 6) + '" class="svg-tick-line" />' +
        '<text x="' + x + '" y="' + (padTop + plotH + 22) + '" text-anchor="middle" class="svg-axis-label">Mes ' + mVal + '</text>';
    }

    const startBal = history[0].endingBalance;
    const endBal = history[history.length - 1].endingBalance;
    const totInt = history[history.length - 1].cumulativeInterest;

    return (
      '<svg viewBox="0 0 ' + width + ' ' + height + '" class="chart-svg" role="img" aria-labelledby="svg-minpay-title svg-minpay-desc">' +
        '<title id="svg-minpay-title">Evolución del saldo de deuda e intereses acumulados mes a mes</title>' +
        '<desc id="svg-minpay-desc">Gráfico que muestra el saldo inicial de $' + startBal.toFixed(2) +
        ' disminuyendo durante ' + maxMonth + ' meses hasta $' + endBal.toFixed(2) +
        ', mientras los intereses acumulados llegan a $' + totInt.toFixed(2) + '.</desc>' +
        '<defs>' +
          '<linearGradient id="balanceAreaGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.28"/>' +
            '<stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0.02"/>' +
          '</linearGradient>' +
        '</defs>' +
        gridLines +
        xLabels +
        '<polygon points="' + areaBalancePoints + '" fill="url(#balanceAreaGrad)" />' +
        '<polyline fill="none" stroke="var(--accent-danger)" stroke-width="2.5" stroke-dasharray="6,4" points="' + interestPoints.join(' ') + '" />' +
        '<polyline fill="none" stroke="var(--accent-primary)" stroke-width="3" points="' + balancePoints.join(' ') + '" />' +
        '<circle cx="' + firstX + '" cy="' + yCoord(startBal).toFixed(1) + '" r="4.5" fill="var(--accent-primary)" />' +
        '<circle cx="' + lastX + '" cy="' + yCoord(endBal).toFixed(1) + '" r="4.5" fill="var(--accent-primary)" />' +
        '<circle cx="' + lastX + '" cy="' + yCoord(totInt).toFixed(1) + '" r="4.5" fill="var(--accent-danger)" />' +
        '<text x="' + (padLeft + plotW / 2) + '" y="' + (height - 6) + '" text-anchor="middle" class="svg-axis-title">Tiempo transcurrido (meses)</text>' +
      '</svg>'
    );
  }

  /* ==========================================================================
   * INICIALIZACIÓN DE INTERFAZ DE USUARIO (DOM)
   * Se ejecuta únicamente cuando existe `document` en el navegador.
   * ========================================================================== */
  function formatCurrency(val) {
    return '$' + Number(val).toLocaleString('es-EC', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatPct(val, decimals) {
    const d = decimals !== undefined ? decimals : 2;
    return Number(val).toLocaleString('es-EC', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    }) + '%';
  }

  /**
   * Tasas oficiales de referencia (verificadas el 21-nov-2026 en la fuente indicada).
   * Los bancos centrales publican tasas EFECTIVAS anuales (ea); el simulador trabaja con
   * tasa nominal anual (TNA = 12 × ((1 + ea)^(1/12) − 1)), así que se convierten al cargarlas.
   */
  function eaToTna(eaPct) {
    return round2(12 * (Math.pow(1 + eaPct / 100, 1 / 12) - 1) * 100);
  }

  function preset(eaPct, source, url) {
    return { ea: eaPct, rate: eaToTna(eaPct), source: source, url: url };
  }

  const BCE_URL = 'https://contenido.bce.fin.ec/documentos/Estadisticas/SectorMonFin/TasasInteres/Indice.htm';
  const COUNTRY_RATE_PRESETS = {
    custom: { ea: null, rate: null, source: 'Ingresa la tasa nominal anual (TNA) de tu contrato o estado de cuenta.', url: null },
    ec_ref: preset(15.69, 'Banco Central del Ecuador · tasa activa efectiva referencial, segmento Consumo, noviembre 2026', BCE_URL),
    ec_max: preset(16.77, 'Banco Central del Ecuador · tasa activa efectiva máxima, segmento Consumo, noviembre 2026', BCE_URL),
    co_usura: preset(28.34, 'Colombia · tasa de usura para crédito de consumo y ordinario certificada por la Superintendencia Financiera, noviembre 2026 (tope legal, no promedio)',
      'https://abceconomia.co/2026/11/03/tasa-usura-noviembre-colombia/'),
    pe_max: preset(114.68, 'Banco Central de Reserva del Perú · tasa máxima de interés convencional compensatorio para créditos de consumo en soles, vigente desde el 02-nov-2026 (tope legal, no promedio)',
      'https://estadisticas.bcrp.gob.pe/estadisticas/series/diarias/resultados/PD38590DD/html')
  };

  const OPPORTUNITY_RATE_PRESETS = {
    custom: { ea: null, rate: null, source: 'Ingresa la tasa anual que ganarías con tu dinero en otra alternativa.', url: null },
    ec_dpf: preset(4.83, 'Banco Central del Ecuador · tasa pasiva efectiva referencial, depósitos a plazo de 181 a 360 días, noviembre 2026', BCE_URL)
  };

  function initBrowserApp() {
    if (typeof document === 'undefined') return;

    // 1. Tema Claro / Oscuro
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeLabel = document.getElementById('theme-toggle-text');
    const rootHtml = document.documentElement;

    function applyTheme(theme) {
      rootHtml.setAttribute('data-theme', theme);
      if (themeLabel) {
        themeLabel.textContent = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
      }
      if (themeToggleBtn) {
        themeToggleBtn.setAttribute(
          'aria-label',
          theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
        );
      }
    }

    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem('crc-theme');
    } catch (_) {
      savedTheme = null;
    }

    if (savedTheme === 'dark' || savedTheme === 'light') {
      applyTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
    } else {
      applyTheme('light');
    }

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', function () {
        const current = rootHtml.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try {
          localStorage.setItem('crc-theme', next);
        } catch (_) {}
      });
    }

    // 2. Navegación por pestañas accesibles (Calculadoras 1, 2 y 3)
    const tabButtons = document.querySelectorAll('[role="tab"]');
    const tabPanels = document.querySelectorAll('[role="tabpanel"]');

    function activateTab(targetBtn) {
      const targetPanelId = targetBtn.getAttribute('aria-controls');
      tabButtons.forEach(function (btn) {
        const isSelected = btn === targetBtn;
        btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        btn.setAttribute('tabindex', isSelected ? '0' : '-1');
        btn.classList.toggle('active', isSelected);
      });
      tabPanels.forEach(function (panel) {
        const isMatch = panel.id === targetPanelId;
        if (isMatch) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', 'hidden');
        }
      });
    }

    tabButtons.forEach(function (btn, idx) {
      btn.addEventListener('click', function () {
        activateTab(btn);
      });
      btn.addEventListener('keydown', function (e) {
        let nextIdx = null;
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabButtons.length;
        if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabButtons.length) % tabButtons.length;
        if (e.key === 'Home') nextIdx = 0;
        if (e.key === 'End') nextIdx = tabButtons.length - 1;
        if (nextIdx !== null) {
          e.preventDefault();
          tabButtons[nextIdx].focus();
          activateTab(tabButtons[nextIdx]);
        }
      });
    });

    // 3. Calculadora 1: Compra a N Cuotas (Sistema Francés)
    const formC1 = document.getElementById('form-calc1');
    const c1Error = document.getElementById('c1-error');

    function renderCalc1() {
      if (!formC1) return;
      const principal = parseFloat(document.getElementById('c1-principal').value);
      const months = parseInt(document.getElementById('c1-months').value, 10);
      const rate = parseFloat(document.getElementById('c1-rate').value);

      try {
        const res = calculateFrenchAmortization({
          principal: principal,
          months: months,
          annualNominalRatePct: rate
        });
        if (c1Error) c1Error.hidden = true;

        document.getElementById('c1-out-payment').textContent = formatCurrency(res.monthlyPayment);
        document.getElementById('c1-out-total').textContent = formatCurrency(res.totalPaid);
        document.getElementById('c1-out-interest').textContent = formatCurrency(res.totalInterest);
        document.getElementById('c1-out-tea').textContent = formatPct(res.effectiveAnnualRatePct, 2);
        document.getElementById('c1-out-monthly-rate').textContent = formatPct(res.monthlyRatePct, 2);
        document.getElementById('c1-out-overcost').textContent = '+' + formatPct(res.overcostPct, 1) + ' sobre el precio original';

        // Barra visual de proporción capital vs intereses
        const capShare = res.totalPaid > 0 ? (res.principal / res.totalPaid) * 100 : 100;
        const intShare = Math.max(0, 100 - capShare);
        const barCap = document.getElementById('c1-bar-principal');
        const barInt = document.getElementById('c1-bar-interest');
        if (barCap && barInt) {
          barCap.style.width = capShare.toFixed(1) + '%';
          barInt.style.width = intShare.toFixed(1) + '%';
        }
        document.getElementById('c1-label-principal-pct').textContent =
          'Capital (' + formatPct(capShare, 1) + ')';
        document.getElementById('c1-label-interest-pct').textContent =
          'Intereses (' + formatPct(intShare, 1) + ')';

        // Tabla de amortización
        const tbody = document.getElementById('c1-schedule-body');
        if (tbody) {
          const rowsHtml = res.schedule.map(function (row) {
            return (
              '<tr>' +
                '<td>' + row.month + '</td>' +
                '<td>' + formatCurrency(row.initialBalance) + '</td>' +
                '<td class="font-semibold">' + formatCurrency(row.payment) + '</td>' +
                '<td class="text-danger">' + formatCurrency(row.interest) + '</td>' +
                '<td class="text-success">' + formatCurrency(row.principal) + '</td>' +
                '<td>' + formatCurrency(row.endingBalance) + '</td>' +
              '</tr>'
            );
          }).join('');
          tbody.innerHTML = rowsHtml;
        }
      } catch (err) {
        if (c1Error) {
          c1Error.textContent = err.message;
          c1Error.hidden = false;
        }
      }
    }

    if (formC1) {
      formC1.addEventListener('submit', function (e) {
        e.preventDefault();
        renderCalc1();
      });
      formC1.addEventListener('input', renderCalc1);
      renderCalc1();
    }

    // 4. Calculadora 2: Simulador de Pago Mínimo
    const formC2 = document.getElementById('form-calc2');
    const c2Error = document.getElementById('c2-error');

    function renderCalc2() {
      if (!formC2) return;
      const balance = parseFloat(document.getElementById('c2-balance').value);
      const rate = parseFloat(document.getElementById('c2-rate').value);
      const minPct = parseFloat(document.getElementById('c2-min-pct').value);
      const minFloor = parseFloat(document.getElementById('c2-min-floor').value);

      try {
        const res = simulateMinimumPayment({
          balance: balance,
          annualNominalRatePct: rate,
          minPaymentPct: minPct,
          minPaymentFloor: minFloor,
          maxMonths: 600
        });
        if (c2Error) c2Error.hidden = true;

        const alertBox = document.getElementById('c2-trap-warning');
        if (res.nonConvergent) {
          if (alertBox) {
            alertBox.hidden = false;
            alertBox.innerHTML =
              '<strong>¡Alerta de amortización negativa!</strong> La tasa mensual (' +
              formatPct(res.monthlyRatePct, 2) +
              ') iguala o supera tu pago mínimo del primer mes. Tu deuda nunca disminuirá si el pago no supera los intereses mensuales.';
          }
          document.getElementById('c2-out-months').textContent = 'Nunca (Crece)';
          document.getElementById('c2-out-years').textContent = 'Deuda perpetua bajo estas condiciones';
        } else if (res.hitCap) {
          if (alertBox) {
            alertBox.hidden = false;
            alertBox.innerHTML =
              '<strong>Simulación truncada en 600 meses (50 años):</strong> Con un pago mínimo tan bajo, aún restarían ' +
              formatCurrency(res.remainingBalance) + ' por pagar.';
          }
          document.getElementById('c2-out-months').textContent = '+600 meses';
          document.getElementById('c2-out-years').textContent = 'Más de 50 años';
        } else {
          if (alertBox) alertBox.hidden = true;
          document.getElementById('c2-out-months').textContent = res.monthsToPayOff + ' meses';
          document.getElementById('c2-out-years').textContent =
            'Equivalente a ' + res.yearsToPayOff + ' años sin nuevas compras';
        }

        document.getElementById('c2-out-interest').textContent = formatCurrency(res.totalInterest);
        document.getElementById('c2-out-total').textContent = formatCurrency(res.totalPaid);
        document.getElementById('c2-out-first-min').textContent = formatCurrency(res.firstMonthMinPayment);
        document.getElementById('c2-out-ratio').textContent =
          'Intereses equivalen al ' + formatPct(res.interestToPrincipalRatioPct, 1) + ' del saldo original';

        const svgContainer = document.getElementById('c2-svg-container');
        if (svgContainer) {
          svgContainer.innerHTML = buildMinimumPaymentSvg(res.history);
        }

        // Resumen de tabla mes a mes (primeros meses + cierre o todos)
        const tbody = document.getElementById('c2-schedule-body');
        if (tbody) {
          const rows = res.history.slice(1).map(function (row) {
            return (
              '<tr>' +
                '<td>' + row.month + '</td>' +
                '<td>' + formatCurrency(row.initialBalance) + '</td>' +
                '<td class="text-danger">' + formatCurrency(row.interest) + '</td>' +
                '<td class="font-semibold">' + formatCurrency(row.payment) + '</td>' +
                '<td class="text-success">' + formatCurrency(row.principalPaid) + '</td>' +
                '<td>' + formatCurrency(row.endingBalance) + '</td>' +
              '</tr>'
            );
          }).join('');
          tbody.innerHTML = rows;
        }
      } catch (err) {
        if (c2Error) {
          c2Error.textContent = err.message;
          c2Error.hidden = false;
        }
      }
    }

    if (formC2) {
      formC2.addEventListener('submit', function (e) {
        e.preventDefault();
        renderCalc2();
      });
      formC2.addEventListener('input', renderCalc2);
      renderCalc2();
    }

    // 5. Calculadora 3: Diferido sin intereses vs Descuento de contado
    const formC3 = document.getElementById('form-calc3');
    const c3Error = document.getElementById('c3-error');

    function renderCalc3() {
      if (!formC3) return;
      const listPrice = parseFloat(document.getElementById('c3-price').value);
      const discountPct = parseFloat(document.getElementById('c3-discount').value);
      const months = parseInt(document.getElementById('c3-months').value, 10);
      const oppRate = parseFloat(document.getElementById('c3-opp-rate').value);

      try {
        const res = compareZeroInterestVsCashDiscount({
          listPrice: listPrice,
          cashDiscountPct: discountPct,
          months: months,
          opportunityAnnualRatePct: oppRate
        });
        if (c3Error) c3Error.hidden = true;

        document.getElementById('c3-out-cash-price').textContent = formatCurrency(res.cashPrice);
        document.getElementById('c3-out-discount-amt').textContent =
          'Ahorro inmediato de ' + formatCurrency(res.cashDiscountAmount);
        document.getElementById('c3-out-pv-deferred').textContent = formatCurrency(res.presentValueOfInstallments);
        document.getElementById('c3-out-installment').textContent =
          res.months + ' cuotas de ' + formatCurrency(res.monthlyInstallment);
        document.getElementById('c3-out-implicit-tea').textContent = formatPct(res.implicitEffectiveAnnualPct, 2);
        document.getElementById('c3-out-implicit-tna').textContent =
          'TNA implícita: ' + formatPct(res.implicitNominalAnnualPct, 2);

        const verdictBanner = document.getElementById('c3-verdict-banner');
        const verdictTitle = document.getElementById('c3-verdict-title');
        const verdictDesc = document.getElementById('c3-verdict-desc');

        if (verdictBanner && verdictTitle && verdictDesc) {
          verdictBanner.className = 'verdict-card';
          if (res.recommendation === 'CONTADO') {
            verdictBanner.classList.add('verdict-cash');
            verdictTitle.textContent = 'Conviene pagar de CONTADO con descuento';
            verdictDesc.textContent =
              'En Valor Presente hoy, pagar de contado te ahorra ' +
              formatCurrency(res.absSavingsPV) +
              ' frente a diferir e invertir tu dinero al ' +
              formatPct(res.opportunityAnnualRatePct, 1) +
              ' anual. Renunciar al descuento equivale a financiarte a una TEA implícita del ' +
              formatPct(res.implicitEffectiveAnnualPct, 2) + '.';
          } else if (res.recommendation === 'DIFERIDO') {
            verdictBanner.classList.add('verdict-deferred');
            verdictTitle.textContent = 'Conviene DIFERIR sin intereses e invertir tu liquidez';
            verdictDesc.textContent =
              'En Valor Presente hoy, diferir a ' +
              res.months +
              ' meses mientras tu capital rinde ' +
              formatPct(res.opportunityAnnualRatePct, 1) +
              ' anual te genera una ventaja neta de ' +
              formatCurrency(res.absSavingsPV) +
              ' frente al descuento de contado del ' +
              formatPct(res.cashDiscountPct, 1) + '.';
          } else {
            verdictBanner.classList.add('verdict-neutral');
            verdictTitle.textContent = 'Ambas opciones son financieramente equivalentes';
            verdictDesc.textContent =
              'El Valor Presente de las cuotas iguala exactamente al precio de contado con descuento.';
          }
        }

        const tbody = document.getElementById('c3-flows-body');
        if (tbody) {
          tbody.innerHTML = res.flows.map(function (fl) {
            return (
              '<tr>' +
                '<td>Cuota ' + fl.month + '</td>' +
                '<td>' + formatCurrency(fl.nominalInstallment) + '</td>' +
                '<td>' + fl.discountFactor.toFixed(4) + '</td>' +
                '<td class="font-semibold">' + formatCurrency(fl.presentValue) + '</td>' +
              '</tr>'
            );
          }).join('');
        }
      } catch (err) {
        if (c3Error) {
          c3Error.textContent = err.message;
          c3Error.hidden = false;
        }
      }
    }

    if (formC3) {
      formC3.addEventListener('submit', function (e) {
        e.preventDefault();
        renderCalc3();
      });
      formC3.addEventListener('input', renderCalc3);
      renderCalc3();
    }

    // 6. Enlace de selectores de referencia oficial a campos de entrada
    function showPresetInfo(infoEl, entry) {
      if (!infoEl || !entry) return;
      infoEl.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = entry.ea === null ? 'Tasa personalizada: ' : 'Fuente oficial: ';
      infoEl.appendChild(strong);
      let text = entry.source;
      if (entry.ea !== null) {
        text += '. ' + formatPct(entry.ea, 2) + ' efectiva anual = ' + formatPct(entry.rate, 2) + ' nominal anual (TNA). ';
      }
      infoEl.appendChild(document.createTextNode(text));
      if (entry.url) {
        const a = document.createElement('a');
        a.href = entry.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = 'Ver fuente';
        infoEl.appendChild(a);
      }
    }

    function wirePreset(selectId, inputId, infoId, presetsMap, renderFn) {
      const selectEl = document.getElementById(selectId);
      const inputEl = document.getElementById(inputId);
      const infoEl = document.getElementById(infoId);
      if (!selectEl || !inputEl) return;
      const initial = presetsMap[selectEl.value];
      if (initial && initial.rate !== null) inputEl.value = initial.rate;
      showPresetInfo(infoEl, initial);

      selectEl.addEventListener('change', function () {
        const entry = presetsMap[selectEl.value];
        if (entry && entry.rate !== null) inputEl.value = entry.rate;
        showPresetInfo(infoEl, entry);
        if (renderFn) renderFn();
      });

      inputEl.addEventListener('input', function () {
        const currentVal = parseFloat(inputEl.value);
        let matched = 'custom';
        for (const k in presetsMap) {
          if (presetsMap[k].rate !== null && Math.abs(presetsMap[k].rate - currentVal) < 0.001) { matched = k; break; }
        }
        if (selectEl.value !== matched) {
          selectEl.value = matched;
          showPresetInfo(infoEl, presetsMap[matched]);
        }
      });
    }

    wirePreset('c1-rate-preset', 'c1-rate', 'c1-preset-info', COUNTRY_RATE_PRESETS, renderCalc1);
    wirePreset('c2-rate-preset', 'c2-rate', 'c2-preset-info', COUNTRY_RATE_PRESETS, renderCalc2);
    wirePreset('c3-opp-preset', 'c3-opp-rate', 'c3-preset-info', OPPORTUNITY_RATE_PRESETS, renderCalc3);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initBrowserApp);
    } else {
      initBrowserApp();
    }
  }

  return {
    round2: round2,
    calculateFrenchAmortization: calculateFrenchAmortization,
    simulateMinimumPayment: simulateMinimumPayment,
    compareZeroInterestVsCashDiscount: compareZeroInterestVsCashDiscount,
    buildMinimumPaymentSvg: buildMinimumPaymentSvg,
    COUNTRY_RATE_PRESETS: COUNTRY_RATE_PRESETS,
    OPPORTUNITY_RATE_PRESETS: OPPORTUNITY_RATE_PRESETS
  };
});

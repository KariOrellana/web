/* Cálculo y observaciones didácticas de la ficha «Mi producto estrella».
 * Todo se calcula aquí (no con IA): así los números son siempre los mismos y se pueden recalcular
 * si la persona corrige algo. Funciona en el navegador (window.FichaCalc) y en Node (pruebas). */
(function (root) {
  'use strict';
  var num = function (x) { return (typeof x === 'number' && isFinite(x)) ? x : null; };
  var suma = function (arr) { return arr.reduce(function (a, b) { return a + (b || 0); }, 0); };

  /* Costo por unidad de cada insumo: usa lo escrito o lo calcula (pago ÷ unidades que alcanza). */
  function costoInsumo(r) {
    var c = num(r.costo_por_unidad);
    if (c !== null) return c;
    var p = num(r.cuanto_pago), a = num(r.alcanza_para);
    return (p !== null && a !== null && a > 0) ? p / a : null;
  }

  /* ficha = datos leídos de la foto (ver esquema en apps-script/Codigo.gs). Devuelve resultados y avisos. */
  function calcular(f) {
    var avisos = [], faltan = [];
    var insumos = (f.insumos || []).filter(function (r) { return r && (r.insumo || costoInsumo(r) !== null); })
      .map(function (r) { return { insumo: r.insumo || 'Insumo', costo: costoInsumo(r) }; });
    var A = suma(insumos.map(function (r) { return r.costo; }));
    if (!insumos.length || insumos.every(function (r) { return r.costo === null; })) {
      if (num(f.total_A) !== null) A = f.total_A; else { A = null; faltan.push('lo que gastas por cada unidad (paso 2)'); }
    } else if (num(f.total_A) !== null && Math.abs(f.total_A - A) > Math.max(2, A * 0.03)) {
      avisos.push('La suma que anotaste en A (' + clp(f.total_A) + ') no coincide con la suma de tus insumos (' + clp(Math.round(A)) + '). Usé la suma de tus insumos.');
    }

    var fijos = (f.fijos_escondidos || []).filter(function (r) { return r && num(r.monto) !== null && r.monto > 0; })
      .map(function (r) { return { concepto: r.concepto || 'Gasto', monto: r.monto, trabajo: /trabaj|famil|mano de obra/i.test(r.concepto || '') }; });
    var B = suma(fijos.map(function (r) { return r.monto; }));
    if (!fijos.length) {
      if (num(f.total_B) !== null && f.total_B > 0) B = f.total_B; else { B = null; faltan.push('lo que pagas igual y lo que no anotas (paso 3)'); }
    } else if (num(f.total_B) !== null && Math.abs(f.total_B - B) > Math.max(2, B * 0.03)) {
      avisos.push('La suma que anotaste en B (' + clp(f.total_B) + ') no coincide con la suma de tus gastos (' + clp(Math.round(B)) + '). Usé la suma de tus gastos.');
    }
    var U = num(f.unidades_producidas), P = num(f.precio_venta_unidad);
    if (U === null || U <= 0) { U = null; faltan.push('cuántas unidades produces'); }
    if (P === null || P <= 0) { P = null; faltan.push('el precio al que vendes hoy'); }

    var r = { A: A, B: B, U: U, P: P, insumos: insumos, fijos: fijos, avisos: avisos, faltan: faltan };
    var trabajo = suma(fijos.filter(function (x) { return x.trabajo; }).map(function (x) { return x.monto; }));
    r.trabajoIncluido = trabajo > 0;
    r.trabajo = trabajo;
    if (A === null || B === null || U === null) { r.completo = false; return r; }

    r.completo = true;
    r.C = B / U;
    r.costoUnidad = A + r.C;
    r.precioMinimo = r.costoUnidad;
    r.precio20 = r.costoUnidad * 1.2;
    if (P !== null) {
      r.D = P - A;                                   // lo que deja cada unidad para pagar los fijos
      r.equilibrio = r.D > 0 ? Math.ceil(B / r.D - 1e-9) : null;
      r.ganUnidad = P - r.costoUnidad;
      r.utilidad = r.ganUnidad * U;                  // si vende todo lo que produce
      r.margen = r.ganUnidad / r.costoUnidad;        // sobre el costo
      r.semaforo = P < r.costoUnidad - 1e-9 ? 'rojo' : (P < r.precio20 - 1e-9 ? 'amarillo' : 'verde');
      r.colchon = r.equilibrio !== null ? U - r.equilibrio : null;   // unidades de margen de seguridad
    }
    return r;
  }

  /* plural simple: kilo→kilos, queso→quesos, unidad→unidades */
  function pl(u, n) { u = u || 'unidad'; if (n === 1) return u; if (/[aeiouáéíóú]$/i.test(u)) return u + 's'; if (/z$/i.test(u)) return u.slice(0, -1) + 'ces'; return u + 'es'; }

  function clp(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + '$' + s;
  }
  /* redondeo «amable» para sugerir precios: al múltiplo de 50 hacia arriba */
  function redondeoArriba(n, paso) { paso = paso || 50; return Math.ceil(n / paso - 1e-9) * paso; }

  /* «Para reflexionar»: observaciones neutras calculadas con los números de la persona.
   * Son didácticas: describen lo que muestran los números, no aconsejan qué hacer. Cada una: {icono, titulo, texto}. */
  function recomendaciones(r, f) {
    var out = [], u = (f && f.unidad_venta) ? f.unidad_venta : 'unidad';
    if (!r.completo) {
      out.push({ icono: '✍️', titulo: 'Completemos tu ficha', texto: 'Para calcular tus números falta: ' + r.faltan.join(', ') + '. Puedes escribirlos abajo, en «Lo que leí de tu ficha», o llenar la ficha de nuevo y sacarle otra foto.' });
      return out;
    }
    if (r.P === null) {
      out.push({ icono: '🏷️', titulo: 'Tu precio mínimo', texto: 'Cada ' + u + ' te cuesta ' + clp(r.costoUnidad) + ': ese es el precio mínimo, el que cubre tu costo. Con 20% de ganancia sobre el costo, el precio de referencia sería ' + clp(redondeoArriba(r.precio20)) + '.' });
      return out;
    }
    if (r.semaforo === 'rojo') {
      var perd = -r.ganUnidad;
      out.push({ icono: '🔴', titulo: 'Hoy vendes bajo tu costo', texto: 'Hacer cada ' + u + ' te cuesta ' + clp(r.costoUnidad) + ' y lo vendes a ' + clp(r.P) + ': la diferencia es de ' + clp(perd) + ' en contra por cada uno. Conocer este número es el primer paso para entender tu negocio.' });
      out.push({ icono: '🏷️', titulo: 'Precios de referencia con tus costos de hoy', texto: 'El precio que cubre tu costo es ' + clp(redondeoArriba(r.precioMinimo)) + ' y el que deja 20% de ganancia es ' + clp(redondeoArriba(r.precio20)) + '. Son referencias calculadas con los números de tu ficha, no un precio sugerido.' });
    } else if (r.semaforo === 'amarillo') {
      var falta = r.precio20 - r.P;
      out.push({ icono: '🟡', titulo: 'Cubres tus costos, pero ganas poco', texto: 'Ganas ' + clp(r.ganUnidad) + ' por cada ' + u + ' (' + Math.round(r.margen * 100) + '% sobre el costo). El verde empieza en 20%: con tus costos de hoy, eso corresponde a un precio de referencia de ' + clp(redondeoArriba(r.precio20)) + ', es decir ' + clp(redondeoArriba(falta, 10)) + ' más por ' + u + ' que tu precio actual.' });
    } else {
      out.push({ icono: '🟢', titulo: 'Tu precio cubre tu costo y deja ganancia', texto: 'Ganas ' + clp(r.ganUnidad) + ' por cada ' + u + ' (' + Math.round(r.margen * 100) + '% sobre tu costo). Si el precio de tus insumos cambia, estos números también cambian: los puedes volver a calcular.' });
    }
    // equilibrio
    if (r.equilibrio === null) {
      out.push({ icono: '⚖️', titulo: 'Tu gasto por ' + u + ' es mayor que tu precio', texto: 'Cada ' + u + ' no alcanza ni para pagar lo que gastas en insumos (' + clp(r.A) + '), así que vender más unidades no logra cubrir tus gastos fijos con estos números.' });
    } else if (r.equilibrio > r.U) {
      out.push({ icono: '⚖️', titulo: 'Con lo que produces no alcanzas a cubrir tus gastos', texto: 'Para no perder se necesita vender ' + r.equilibrio + ' ' + pl(u, r.equilibrio) + ' y produces ' + r.U + '. Aunque se venda todo, el resultado queda en pérdida.' });
    } else if (r.colchon <= r.U * 0.1) {
      out.push({ icono: '⚖️', titulo: 'Tu margen de seguridad es justo', texto: 'Para no perder se necesita vender ' + r.equilibrio + ' de los ' + r.U + ' ' + pl(u, r.U) + ' que produces. Si un mes se vende un poco menos, el resultado pasa a pérdida.' });
    } else {
      out.push({ icono: '⚖️', titulo: 'Tu punto de equilibrio: ' + r.equilibrio + ' ' + pl(u, r.equilibrio), texto: 'Desde el número ' + r.equilibrio + ' empiezas a ganar. Te sobran ' + r.colchon + ' de los ' + r.U + ' que produces: ese es tu margen de seguridad.' });
    }
    // lo que no anotas
    if (!r.trabajoIncluido) {
      out.push({ icono: '🙈', titulo: 'No anotaste tu trabajo', texto: 'En el paso 3 no aparece tu trabajo ni el de tu familia. Sin contarlo, los números se ven mejores de lo que son. Si lo anotas (días trabajados y valor del día en tu zona), el cálculo queda más completo.' });
    }
    // dónde está el gasto grande
    var partes = [];
    r.insumos.forEach(function (x) { if (x.costo) partes.push({ n: x.insumo, v: x.costo, tipo: 'insumo' }); });
    r.fijos.forEach(function (x) { partes.push({ n: x.concepto, v: x.monto / r.U, tipo: 'fijo' }); });
    partes.sort(function (a, b) { return b.v - a.v; });
    if (partes.length) {
      var g = partes[0], pc = Math.round(g.v / r.costoUnidad * 100);
      var nota = (g.tipo !== 'insumo' && /trabaj|famil/i.test(g.n)) ? ' Es normal: tu trabajo es parte del costo.' : '';
      out.push({ icono: '🔎', titulo: 'Tu gasto más grande: ' + g.n.toLowerCase(), texto: 'Pesa ' + clp(g.v) + ' en cada ' + u + ' (' + pc + '% de tu costo).' + nota });
    }
    // peso de los gastos fijos
    if (r.C / r.costoUnidad > 0.5 && r.semaforo !== 'verde') {
      out.push({ icono: '📦', titulo: 'El peso de los gastos que pagas igual', texto: 'Más de la mitad de tu costo (' + clp(r.C) + ' por ' + u + ') son gastos que pagas igual. Por eso, la cantidad de unidades que se vende cambia mucho el costo de cada una.' });
    }
    out.push({ icono: '📒', titulo: 'Tarea del taller: 30 días de registro', texto: 'Anota en tu libreta todo lo que entra y todo lo que sale. En la próxima visita se recalcula con tus datos reales. Después pasa estos números a tu Canvas: costos en el recuadro 8, ingresos en el 9 y utilidad en el 12.' });
    return out;
  }


  /* ───── Métricas adicionales (se muestran después de los resultados) ───── */
  var ESCONDIDO = /trabaj|famil|mano de obra|desgast|pierd|regal|muestra/i;
  function metricas(r, f) {
    var m = {};
    if (!r.completo) return m;
    var u = (f && f.unidad_venta) || 'unidad';
    m.unidad = u;
    m.costoTotal = r.costoUnidad * r.U;                       // todo lo que gasta en el periodo (incluye su trabajo)
    m.partes = [];                                            // en qué se va el costo de 1 unidad
    r.insumos.forEach(function (x) { if (x.costo) m.partes.push({ n: x.insumo, v: x.costo, grupo: 'insumo' }); });
    r.fijos.forEach(function (x) { m.partes.push({ n: x.concepto, v: x.monto / r.U, grupo: ESCONDIDO.test(x.concepto) ? 'escondido' : 'fijo' }); });
    m.partes.sort(function (a, b) { return b.v - a.v; });
    var g = { insumo: 0, fijo: 0, escondido: 0 };
    m.partes.forEach(function (x) { g[x.grupo] += x.v; });
    m.grupos = g;                                             // $ por unidad en cada grupo
    m.pcGrupos = { insumo: g.insumo / r.costoUnidad, fijo: g.fijo / r.costoUnidad, escondido: g.escondido / r.costoUnidad };
    var d = (f && f.fijos_escondidos || []).filter(function (x) { return x && /trabaj/i.test(x.concepto || '') && !/famil/i.test(x.concepto || ''); })[0];
    if (d && d.dias > 0 && d.monto > 0) m.valorDia = d.monto / d.dias;
    if (r.P) {
      m.ingresos = r.P * r.U;
      m.utilidad = m.ingresos - m.costoTotal;
      m.centavosPorCien = r.ganUnidad / r.P * 100;           // de cada $100 vendidos, cuánto queda
      m.utilidadBolsillo = m.utilidad + r.trabajo;           // lo que queda sin contar lo que vale su propio trabajo
      m.equilibrioPc = r.equilibrio !== null ? r.equilibrio / r.U : null;
      m.paraVerde = r.precio20 - r.P;                        // cuánto subir el precio (o bajar el costo) por unidad
      m.menos10 = (r.P - r.A) * r.U * 0.9 - r.B;             // utilidad si vendiera 10% menos
      m.mas100 = r.U * 100;                                  // lo que suma subir el precio $100 (si vende lo mismo)
      if (f && f.periodo === 'temporada' && f.meses_temporada > 0) m.utilidadMensual = m.utilidad / f.meses_temporada;
    }
    return m;
  }
  /* Simulador «¿y si…?»: cambia precio y unidades vendidas. */
  function simular(r, precio, vendidas) {
    var util = (precio - r.A) * vendidas - r.B, cu = r.costoUnidad;
    var D = precio - r.A;
    return { utilidad: util, semaforo: precio < cu - 1e-9 ? 'rojo' : (precio < cu * 1.2 - 1e-9 ? 'amarillo' : 'verde'),
             equilibrio: D > 0 ? Math.ceil(r.B / D - 1e-9) : null, ingresos: precio * vendidas };
  }

  var api = { metricas: metricas, simular: simular, pl: pl, calcular: calcular, recomendaciones: recomendaciones, clp: clp, costoInsumo: costoInsumo, redondeoArriba: redondeoArriba };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FichaCalc = api;
})(typeof window !== 'undefined' ? window : this);

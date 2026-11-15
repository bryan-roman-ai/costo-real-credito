# Costo Real del Crédito — Simulador Educativo (Ecuador y Latam)

> **Aviso importante:** Herramienta educativa. No es asesoría financiera. Ningún dato prellenado representa tasas reales ni estadísticas bancarias; todos los números iniciales son **valores de ejemplo** con fines exclusivamente didácticos.

**Costo Real del Crédito** es una aplicación web estática (HTML5 + CSS3 + JavaScript puro, cero dependencias externas y sin CDN) diseñada para transparentar de forma visual y matemática cuánto cuesta realmente diferir compras con tarjeta de crédito en Ecuador y Latinoamérica.

---

## ¿Qué hace este simulador?

El proyecto integra tres herramientas interactivas en pestañas accesibles:

1. **Calculadora 1 — Compra a N cuotas con intereses (Sistema Francés):**
   - A partir del monto de la compra ($P$), el plazo en meses ($n$) y la Tasa Nominal Anual ($TNA$) ingresada por el usuario, calcula:
     - Cuota mensual fija ($C$).
     - Total desembolsado al finalizar el plazo.
     - Intereses totales pagados y sobrecosto porcentual sobre el precio original.
     - Tasa Efectiva Anual ($TEA$) equivalente por capitalización mensual.
   - Incluye barra visual de proporción Capital vs. Intereses y **tabla de amortización completa** mes a mes.

2. **Calculadora 2 — Simulador de «Pago Mínimo»:**
   - Simula mes a mes qué ocurre cuando se mantiene un saldo en la tarjeta y solo se abona el porcentaje de pago mínimo mensual (con un piso mínimo en dólares cuando el saldo baja).
   - Calcula cuántos meses y años toma liquidar la deuda y cuánto dinero se va en intereses.
   - Detecta automáticamente escenarios de **amortización negativa** (cuando el pago mínimo ni siquiera cubre el interés mensual y la deuda crece indefinidamente).
   - Renderiza un **gráfico SVG hecho a mano** (sin librerías externas) que compara la curva de saldo pendiente frente a los intereses acumulados a lo largo del tiempo.

3. **Calculadora 3 — «Diferido sin intereses» vs. Descuento por pago de contado:**
   - Evalúa si conviene pagar de contado aprovechando un descuento inmediato o diferir «sin intereses» mientras el capital propio rinde a una **tasa de oportunidad anual** ingresada por el usuario.
   - Descuenta cada flujo mensual a **Valor Presente ($VP$)** y calcula además la **Tasa Efectiva Anual ($TEA$) implícita** que se paga de forma oculta al renunciar al descuento de contado.

---

## Fórmulas Matemáticas Utilizadas

### 1. Compra a N cuotas (Sistema de Amortización Francés)

Dada una Tasa Nominal Anual ($TNA$, en decimal) con capitalización mensual:

- **Tasa periódica mensual ($i$):**
  $$i = \frac{TNA}{12}$$

- **Cuota fija mensual ($C$) para un capital $P$ en $n$ meses:**
  $$C = \begin{cases} \dfrac{P \cdot i \cdot (1 + i)^n}{(1 + i)^n - 1} & \text{si } i > 0 \\[8pt] \dfrac{P}{n} & \text{si } i = 0 \end{cases}$$

- **Tasa Efectiva Anual ($TEA$):**
  $$TEA = (1 + i)^{12} - 1$$

- **Desglose en cada mes $k \in \{1, \dots, n\}$:**
  $$I_k = \text{Saldo}_{k-1} \cdot i, \qquad \text{AbonoCapital}_k = C - I_k, \qquad \text{Saldo}_k = \text{Saldo}_{k-1} - \text{AbonoCapital}_k$$

---

### 2. Simulación Mes a Mes del Pago Mínimo

En cada mes $t = 1, 2, \dots$ mientras el saldo sea positivo:

1. **Interés del mes:**
   $$I_t = \text{Saldo}_{t-1} \cdot \left(\frac{TNA}{12}\right)$$
2. **Pago mínimo exigido (con porcentaje $p_{\min}$ y piso monetario $M_{\text{piso}}$):**
   $$\text{Pago}_t = \min\Big(\text{Saldo}_{t-1} + I_t,\; \max(\text{Saldo}_{t-1} \cdot p_{\min},\; M_{\text{piso}})\Big)$$
3. **Abono a capital y nuevo saldo:**
   $$\text{AbonoCapital}_t = \text{Pago}_t - I_t, \qquad \text{Saldo}_t = \text{Saldo}_{t-1} - \text{AbonoCapital}_t$$

> Si en el primer mes $\text{Pago}_1 \le I_1$, el abono a capital es $\le 0$ y la deuda nunca se extingue (**amortización negativa**).

---

### 3. Diferido «Sin Intereses» vs. Descuento de Contado (Valor Presente)

Sea $P_{\text{lista}}$ el precio en cuotas, $d$ el porcentaje de descuento por pago de contado, $n$ el número de meses y $r_{\text{anual}}$ la tasa anual de oportunidad del usuario:

- **Precio de contado ($P_{\text{contado}}$):**
  $$P_{\text{contado}} = P_{\text{lista}} \cdot (1 - d)$$

- **Cuota mensual sin intereses ($C$) y tasa mensual de oportunidad ($r_m$):**
  $$C = \frac{P_{\text{lista}}}{n}, \qquad r_m = \frac{r_{\text{anual}}}{12}$$

- **Valor Presente de las $n$ cuotas ($VP$):**
  $$VP = \sum_{t=1}^{n} \frac{C}{(1 + r_m)^t} = C \cdot \frac{1 - (1 + r_m)^{-n}}{r_m}$$

- **Criterio de decisión financiera:**
  - Si $P_{\text{contado}} < VP$: **Conviene pagar de contado** (ahorro neto en valor presente de $VP - P_{\text{contado}}$).
  - Si $VP < P_{\text{contado}}$: **Conviene diferir sin intereses** e invertir la liquidez (ventaja neta en valor presente de $P_{\text{contado}} - VP$).

---

## Descripción Visual de la Interfaz (Captura Descrita)

La interfaz sigue un diseño **Mobile-First**, limpio y de alto contraste con soporte nativo para **Modo Claro** y **Modo Oscuro**:

1. **Franja superior de advertencia educativa:** Banner destacado en tono ámbar suave con la leyenda *"Herramienta educativa. No es asesoría financiera"* y la aclaración de que todos los valores prellenados son ejemplos didácticos.
2. **Encabezado principal:** Título *"Costo Real del Crédito"*, subtítulo explicativo para Ecuador/Latam y botón conmutador de tema (`Modo oscuro` / `Modo claro`) en la esquina superior derecha.
3. **Barra de navegación por pestañas (`tablist`):** Tres botones numerados (`1. Compra a N Cuotas`, `2. Simulador de Pago Mínimo`, `3. Sin Intereses vs. Contado`) navegables con teclado (`ArrowLeft`, `ArrowRight`, `Home`, `End`).
4. **Cuerpo de cada calculadora (Diseño en 2 columnas en escritorio, 1 columna en móvil):**
   - **Columna izquierda (Formulario):** Tarjeta con insignia *"Valores de ejemplo"*, campos numéricos claramente etiquetados con ayudas contextuales y botón de acción.
   - **Columna derecha (Resultados y Educación):**
     - Cuadrícula de tarjetas KPI con tipografía grande (ej. Cuota fija mensual `$94.56`, Total pagado `$1,134.72`, Intereses `$134.72`, TEA `26.82%`).
     - En la **Calculadora 1**: Barra horizontal apilada que muestra visualmente el porcentaje destinado a Capital (azul) frente a Intereses (rojo).
     - En la **Calculadora 2**: Gráfico **SVG vectorial responsivo** con área sombreada bajo la curva de saldo de deuda (línea continua azul) y línea punteada roja para los intereses acumulados mes a mes.
     - En la **Calculadora 3**: Tarjeta de veredicto dinámica que resalta en verde o azul qué alternativa ahorra más dinero en Valor Presente.
     - Tarjeta didáctica *"¿Cómo se calcula?"* con las ecuaciones paso a paso en lenguaje claro.
5. **Sección inferior de tabla detallada:** Tabla con encabezados fijos (`sticky`), desplazamiento horizontal seguro en pantallas pequeñas y desglose período por período.
6. **Pie de página:** Aviso educativo y atribución al autor con enlace profesional.

---

## Cómo correr el proyecto localmente y en GitHub Pages

### 1. Abrir en el navegador (Cero configuración)
Al ser un sitio 100% estático sin dependencias ni compilación, puedes abrir directamente `index.html` en cualquier navegador moderno o servir la carpeta con un servidor local:

```bash
# Opción A: Con Python 3
python3 -m http.server 8000
# Luego abre http://localhost:8000 en tu navegador
```

### 2. Ejecutar las pruebas automatizadas
El archivo `tests.js` verifica todas las funciones matemáticas con casos calculados a mano (incluyendo el caso de $1,000 a 12 cuotas al 24% TNA → cuota $94.56):

```bash
node tests.js
```

### 3. Publicar en GitHub Pages
1. Sube este repositorio a GitHub.
2. Ve a **Settings → Pages**.
3. En **Source**, selecciona `Deploy from a branch` y elige la rama principal (`main` o `master`) en la carpeta `/ (root)`.
4. ¡Listo! El sitio funcionará de inmediato sin pasos de build.

---

## Estructura de Archivos

- `index.html` — Estructura semántica accesible (ARIA tabs, roles, formularios y tablas).
- `style.css` — Diseño responsivo Mobile-First, variables CSS para modo claro/oscuro y estilos del gráfico SVG.
- `app.js` — Motor matemático (compatible con navegador y CommonJS para pruebas) y controlador del DOM.
- `tests.js` — Suite de pruebas unitarias sin dependencias para validar las fórmulas matemáticas.
- `README.md` — Documentación del proyecto, fórmulas y guía de uso.
- `LICENSE` — Licencia MIT.

---

## Autor y Licencia

Hecho por **Bryan Román** · [linkedin.com/in/bryan-roman-ai](https://linkedin.com/in/bryan-roman-ai)

Distribuido bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

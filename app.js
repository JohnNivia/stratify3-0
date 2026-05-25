'use strict';


const StratifyUtils = (() => {
    const $ = (selector, context = document) => context.querySelector(selector);
    const $$ = (selector, context = document) => context.querySelectorAll(selector);
    const formatCOP = (value) =>
        new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 2,
    }).format(value);
    const formatNumber = (value, decimals = 2) =>
        parseFloat(value).toFixed(decimals);
    const numVal = (input) => parseFloat(input?.value) || 0;
    const showFieldError = (field, message) => {
    const group = field.closest('.form-group');
        if (!group) return;
        group.classList.add('has-error');
        let errorEl = group.querySelector('.form-error-msg');
        if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.className = 'form-error-msg';
        field.insertAdjacentElement('afterend', errorEl);
    }
    errorEl.textContent = message;
    };
    const clearFieldError = (field) => {
        const group = field.closest('.form-group');
        if (!group) return;
        group.classList.remove('has-error');
        const errorEl = group.querySelector('.form-error-msg');
        if (errorEl) errorEl.textContent = '';
    };
    const on = (el, event, handler) => {
    if (!el) return;
    el.addEventListener(event, handler);
    };

    return { $, $$, formatCOP, formatNumber, numVal, showFieldError, clearFieldError, on }; 
})();

const StratifyForm = (() => {

    const { $, $$, showFieldError, clearFieldError, on } = StratifyUtils;
    const validators = {
        required: (value) => value.trim() !== '' || 'Este campo es obligatorio.',
        email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Ingresa un correo electrónico válido.',
        minLength: (min) => (value) => value.length >= min || `Mínimo ${min} caracteres.`,
        numeric: (value) => !isNaN(value) && value.trim() !== '' || 'Solo se permiten números.',
        positiveNumber: (value) => parseFloat(value) > 0 || 'Debe ser un número mayor a 0.',
        pattern: (regex, msg) => (value) => regex.test(value) || msg,
    };
    const validateField = (field, rules) => {
        clearFieldError(field);
        for (const rule of rules) {
        const result = rule(field.value);
            if (result !== true) {
            showFieldError(field, result);
            return false;
            } 
        }
    return true;
    };

    const init = (form, fieldRules) => {
        if (!form) return { isValid: () => true };
        Object.keys(fieldRules).forEach((name) => {
        const field = form.querySelector(`[name="${name}"]`) || form.querySelector(`#${name}`);
        if (!field) return;

        on(field, 'blur', () => validateField(field, fieldRules[name]));
        on(field, 'input', () => {
            if (field.closest('.form-group')?.classList.contains('has-error')) {
            validateField(field, fieldRules[name]);
            }
        });
    });

    const isValid = () => {
        let allValid = true;
        Object.keys(fieldRules).forEach((name) => {
    const field = form.querySelector(`[name="${name}"]`) || form.querySelector(`#${name}`);
        if (!field) return;
        if (!validateField(field, fieldRules[name])) allValid = false;
    });
    return allValid;
    };
    on(form, 'submit', (e) => {
        if (!isValid()) {
            e.preventDefault();
            const firstError = form.querySelector('.form-group.has-error input, .form-group.has-error select');
            firstError?.focus();
        }
    });

    return { isValid };
    };

    return { init, validators };
})();

const StratifyFactura = (() => {
    const { $, numVal, formatNumber } = StratifyUtils;
    const IVA_RATE = 0.19;
    const getRowInputs = (rowIndex) => {
    const inputs = {
        cantidad:       $(`input[name="cantidad-${rowIndex}"]`),
        precioUnitario: $(`input[name="precio-unitario-${rowIndex}"]`),
        descuento:      $(`input[name="descuento-${rowIndex}"]`),
        valorTotal:     $(`input[name="valor-total-${rowIndex}"]`),
    };
    if (!inputs.cantidad) return null;
    return inputs;
    };

  /**
   * Calcula el valor total de una fila de producto.
   * @param {number} rowIndex
   */
  const calcularFila = (rowIndex) => {
    const row = getRowInputs(rowIndex);
    if (!row) return;

    const cantidad       = numVal(row.cantidad);
    const precioUnitario = numVal(row.precioUnitario);
    const descuentoPct   = numVal(row.descuento);

    const valorBruto    = cantidad * precioUnitario;
    const descuentoAbs  = valorBruto * (descuentoPct / 100);
    const valorNeto     = valorBruto - descuentoAbs;

    row.valorTotal.value = formatNumber(valorNeto);
    calcularTotales();
  };

  /**
   * Cuenta cuántas filas de detalle existen en la tabla de venta.
   * @returns {number}
   */
  const contarFilas = () => {
    const tbody = document.querySelector('#detalle-venta tbody');
    return tbody ? tbody.querySelectorAll('tr').length : 0;
  };

  /**
   * Recalcula subtotal, IVA, descuentos y total a pagar.
   */
  const calcularTotales = () => {
    const totalFilas = contarFilas();
    let subtotalBruto  = 0;
    let descuentoTotal = 0;

    for (let i = 1; i <= totalFilas; i++) {
      const row = getRowInputs(i);
      if (!row) continue;

      const cantidad       = numVal(row.cantidad);
      const precioUnitario = numVal(row.precioUnitario);
      const descuentoPct   = numVal(row.descuento);

      const valorBruto   = cantidad * precioUnitario;
      const descuentoAbs = valorBruto * (descuentoPct / 100);

      subtotalBruto  += valorBruto;
      descuentoTotal += descuentoAbs;
    }

    const subtotalNeto = subtotalBruto - descuentoTotal;
    const iva          = subtotalNeto * IVA_RATE;
    const totalPagar   = subtotalNeto + iva;

    // Actualizar campos de totales
    const setField = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = formatNumber(value);
    };

    setField('subtotal',         subtotalBruto);
    setField('descuento-total',  descuentoTotal);
    setField('iva',              iva);
    setField('valor-total-pagar', totalPagar);
  };

  /**
   * Limpia todos los campos calculados (subtotal, IVA, totales).
   */
  const limpiarCalculos = () => {
    ['subtotal', 'iva', 'descuento-total', 'valor-total-pagar'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const totalFilas = contarFilas();
    for (let i = 1; i <= totalFilas; i++) {
      const row = getRowInputs(i);
      if (row?.valorTotal) row.valorTotal.value = '';
    }
  };

  /**
   * Inicializa los listeners de la tabla de factura.
   */
  const init = () => {
    const tabla = document.getElementById('detalle-venta');
    if (!tabla) return;

    // Delegación de eventos: escucha cambios en cualquier input de la tabla
    tabla.addEventListener('input', (e) => {
      const input = e.target;
      // Determina el número de fila del input afectado
      const nameMatch = input.name?.match(/-([\d]+)$/);
      if (nameMatch) {
        calcularFila(parseInt(nameMatch[1], 10));
      }
    });

    // Botón limpiar formulario
    const resetBtn = document.querySelector('button[type="reset"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        // Espera a que el reset nativo del form ocurra primero
        setTimeout(limpiarCalculos, 0);
      });
    }

    // Validación del formulario de factura
    const form = document.querySelector('form');
    if (form) {
      const { validators } = StratifyForm;
      StratifyForm.init(form, {
        'fecha-emision':   [validators.required],
        'hora-emision':    [validators.required],
        'numero-factura':  [validators.required, validators.pattern(
          /^[A-Za-z]{3}-\d{4}-\d{4}$/,
          'Formato: 3 letras, guion, 4 dígitos, guion, 4 dígitos (ej: FAC-2026-0001)'
        )],
        'tipo-factura':    [validators.required],
        'numero-documento': [validators.required],
      });
    }
  };

  // Expone solo lo necesario
  return { init, calcularFila, limpiarCalculos };
})();


/* ==========================================================================
   MÓDULO: StratifyApp
   Inicialización global y detección de página activa.
   ========================================================================== */
const StratifyApp = (() => {

  const { validators } = StratifyForm;

  /**
   * Inicialización para la página de Login.
   */
  const initLogin = () => {
    const form = document.querySelector('form');
    if (!form) return;
    StratifyForm.init(form, {
      'name': [validators.required],
      'pass': [validators.required, validators.minLength(6)],
    });
  };

  /**
   * Inicialización para la página de Usuarios.
   */
  const initUsuarios = () => {
    const form = document.querySelector('form');
    if (!form) return;
    StratifyForm.init(form, {
      'Nombre':            [validators.required],
      'apellido':          [validators.required],
      'correo':            [validators.required, validators.email],
      'contraseña':        [validators.required, validators.minLength(8)],
      'tipo_documento':    [validators.required],
      'numero_documento':  [validators.required, validators.numeric],
    });
  };

  /**
   * Inicialización para la página de Producto.
   */
  const initProducto = () => {
    const form = document.querySelector('form');
    if (!form) return;
    StratifyForm.init(form, {
      'nombre_producto': [validators.required],
      'codigo_producto': [validators.required],
      'categoria':       [validators.required],
      'descripcion':     [validators.required],
      'precio_compra':   [validators.required, validators.positiveNumber],
      'precio_venta':    [validators.required, validators.positiveNumber],
      'stock_actual':    [validators.required],
    });
  };

  /**
   * Inicialización para la página de Proveedores.
   */
  const initProveedores = () => {
    const form = document.querySelector('form');
    if (!form) return;
    StratifyForm.init(form, {
      'razon_social':           [validators.required],
      'tipo_documento':         [validators.required],
      'numero_documento':       [validators.required],
      'direccion':              [validators.required],
      'ciudad':                 [validators.required],
      'nombre_contacto':        [validators.required],
      'telefono':               [validators.required],
      'email':                  [validators.required, validators.email],
      'rubro':                  [validators.required],
      'descripcion_productos':  [validators.required],
    });
  };

  /**
   * Inicialización para la página de Ubicación.
   */
  const initUbicacion = () => {
    const form = document.querySelector('form');
    if (!form) return;
    StratifyForm.init(form, {
      'codigo-ubicacion': [validators.required, validators.pattern(
        /^[A-Za-z]{4}-\d{3}$/,
        'Formato: 4 letras, guion, 3 dígitos (ej: UBIC-001)'
      )],
      'fecha-registro': [validators.required],
      'lugar-venta':    [validators.required],
      'direccion':      [validators.required],
      'local':          [validators.required],
      'estado':         [validators.required],
      'ciudad':         [validators.required],
    });
  };

  /**
   * Mapa de páginas a sus inicializadores.
   * Detecta la página por el <title> del documento.
   */
  const PAGE_MAP = {
    'inicio sesion':       initLogin,
    'registro nuevo usuario': initUsuarios,
    'registro de nuevo producto': initProducto,
    'formulario de registro de proveedor': initProveedores,
    'ubicación':           initUbicacion,
    'factura de venta':    StratifyFactura.init,
  };

  /**
   * Punto de entrada principal. Se llama al cargar el DOM.
   */
  const init = () => {
    const pageTitle = document.title.toLowerCase().trim();

    // Busca si alguna clave del mapa está incluida en el título
    for (const [key, initFn] of Object.entries(PAGE_MAP)) {
      if (pageTitle.includes(key)) {
        initFn();
        break;
      }
    }
  };

  return { init };
})();


/* ==========================================================================
   ARRANQUE
   ========================================================================== */
document.addEventListener('DOMContentLoaded', StratifyApp.init);
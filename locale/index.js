export const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = Object.freeze(['en', 'ru', 'es']);
export const DEFAULT_LOCALE_MODE = 'auto';
export const SUPPORTED_LOCALE_MODES = Object.freeze([
  DEFAULT_LOCALE_MODE,
  ...SUPPORTED_LOCALES,
]);

export const LOCALE_LABELS = Object.freeze({
  en: 'English',
  ru: 'Русский',
  es: 'Español',
});

const EN_MESSAGES = Object.freeze({
  'dialog.cancel': 'Cancel',
  'dialog.confirm': 'Confirm',
  'dialog.ok': 'OK',
  'networkApproval.title': 'Network approval',
  'networkApproval.heading': 'Waiting for local approval',
  'networkApproval.message': 'This network browser must be approved from an already authorized local browser.',
  'networkApproval.requestLabel': 'Request',
  'networkApproval.addressLabel': 'Address',
  'networkApproval.waitingStatus': 'Waiting...',
  'networkApproval.approvedStatus': 'Approved. Opening...',
  'networkApproval.rejectedStatus': 'Rejected from the local browser.',
  'quickOpen.placeholder': 'Search files...',
  'quickOpen.empty': 'No files found',
  'chat.composer.placeholder': 'Ask anything',
  'chat.list.title': 'Chats',
  'chat.list.new': 'New',
  'chat.list.empty': 'No chats yet.',
  'chat.list.filter.all': 'All',
  'chat.list.filter.project': 'By Project',
  'chat.list.filter.active': 'Active',
  'chat.sidebar.new': 'New chat',
  'chat.sidebar.title': 'Chats',
  'chat.sidebar.delete': 'Delete',
  'chat.sidebar.deleteChat': 'Delete chat',
  'chat.sidebar.toggleChildren': 'Toggle child chats',
  'chat.message.input': 'Input',
  'chat.message.result': 'Result',
  'chat.message.running': 'Running...',
  'chat.message.queued': 'Queued',
  'chat.message.item': 'Item',
  'chat.message.completed': 'Completed',
  'chat.message.failed': 'Failed',
  'chat.message.cancelled': 'Cancelled',
  'chat.message.copyResponse': 'Copy response',
  'chat.message.workedFor': 'Worked for {elapsed}',
  'chat.message.thinkingFor': 'Thinking for {elapsed}',
  'chat.meta.tokens': 'Tokens',
  'chat.meta.cost': 'Cost',
  'chat.meta.exit': 'exit {code}',
  'chat.meta.toolCall': '{count} tool call',
  'chat.meta.toolCalls': '{count} tool calls',
  'toolbar.duplicate': 'Duplicate',
  'toolbar.mute': 'Mute',
  'toolbar.delete': 'Delete',
  'toolbar.enterSubgraph': 'Enter Subgraph',
  'toolbar.exploreConnections': 'Explore connections',
  'toolbar.viewCode': 'View Code',
  'inspector.empty': 'Select a node',
  'inspector.label': 'Label',
  'inspector.type': 'Type',
  'inspector.category': 'Category',
  'inspector.inputs': 'Inputs',
  'inspector.outputs': 'Outputs',
  'inspector.controls': 'Controls',
  'inspector.fire': 'Fire',
  'inspector.subgraph': 'Subgraph',
  'inspector.innerNodes': 'Inner Nodes',
  'inspector.enterSubgraph': 'Enter Subgraph',
  'templatePreview.placeholders': 'Placeholders',
  'templatePreview.empty': 'Type {field} in template to add placeholders',
  'templatePreview.testData': 'Test Data (JSON)',
  'templatePreview.preview': 'Preview',
  'context.deleteNode': 'Delete Node',
  'context.cloneNode': 'Clone Node',
  'context.selectAll': 'Select All',
  'context.deleteConnection': 'Delete Connection',
  'context.addNode': 'Add Node',
  'context.addComment': 'Add Comment',
  'context.addFrame': 'Add Frame',
  'context.paste': 'Paste',
  'context.fitView': 'Fit View',
  'context.autoLayout': 'Auto Layout',
  'nodeCanvas.addNode': 'Add Node',
  'nodeCanvas.toggleMinimap': 'Toggle minimap',
  'nodeSearch.placeholder': 'Search nodes...',
  'palette.title': 'Components',
  'palette.searchPlaceholder': 'Search components...',
  'tree.loading': 'Loading...',
  'tree.filterPlaceholder': 'Filter...',
  'tree.collapseAll': 'Collapse all',
  'loading.label': 'Loading',
  'loading.initializing': 'Initializing...',
  'eventFeed.title': 'Events',
  'eventFeed.empty': 'No events',
  'outputGraph.title': 'Graph',
  'outputGraph.empty': 'No graph data',
  'outputGraph.truncated': 'Preview truncated',
  'layout.collapse': 'Collapse',
  'layout.fullscreen': 'Fullscreen',
  'layout.resetAll': 'Reset all layouts to default',
  'tabs.close': 'Close',
  'tabs.new': 'New tab',
  'tabs.home': 'Home',
  'tabs.openProject': 'Open project',
  'sourceViewer.showInGraph': 'Show in Graph',
  'sourceViewer.toggleViewMode': 'Toggle view mode',
  'sourceViewer.graphLabel': 'graph',
});

const RU_MESSAGES = Object.freeze({
  'dialog.cancel': 'Отмена',
  'dialog.confirm': 'Подтвердить',
  'dialog.ok': 'OK',
  'networkApproval.title': 'Подтверждение сети',
  'networkApproval.heading': 'Ожидание локального подтверждения',
  'networkApproval.message': 'Этот сетевой браузер нужно подтвердить из уже авторизованного локального браузера.',
  'networkApproval.requestLabel': 'Запрос',
  'networkApproval.addressLabel': 'Адрес',
  'networkApproval.waitingStatus': 'Ожидание...',
  'networkApproval.approvedStatus': 'Подтверждено. Открываем...',
  'networkApproval.rejectedStatus': 'Отклонено из локального браузера.',
  'quickOpen.placeholder': 'Поиск файлов...',
  'quickOpen.empty': 'Файлы не найдены',
  'chat.composer.placeholder': 'Спросите что-нибудь',
  'chat.list.title': 'Чаты',
  'chat.list.new': 'Новый',
  'chat.list.empty': 'Чатов пока нет.',
  'chat.list.filter.all': 'Все',
  'chat.list.filter.project': 'По проекту',
  'chat.list.filter.active': 'Активные',
  'chat.sidebar.new': 'Новый чат',
  'chat.sidebar.title': 'Чаты',
  'chat.sidebar.delete': 'Удалить',
  'chat.sidebar.deleteChat': 'Удалить чат',
  'chat.sidebar.toggleChildren': 'Показать дочерние чаты',
  'chat.message.input': 'Ввод',
  'chat.message.result': 'Результат',
  'chat.message.running': 'Выполняется...',
  'chat.message.queued': 'В очереди',
  'chat.message.item': 'Элемент',
  'chat.message.completed': 'Завершено',
  'chat.message.failed': 'Ошибка',
  'chat.message.cancelled': 'Отменено',
  'chat.message.copyResponse': 'Скопировать ответ',
  'chat.message.workedFor': 'Работал {elapsed}',
  'chat.message.thinkingFor': 'Думает {elapsed}',
  'chat.meta.tokens': 'Токены',
  'chat.meta.cost': 'Стоимость',
  'chat.meta.exit': 'код выхода {code}',
  'chat.meta.toolCall': '{count} вызов инструмента',
  'chat.meta.toolCalls': '{count} вызовов инструмента',
  'toolbar.duplicate': 'Дублировать',
  'toolbar.mute': 'Отключить',
  'toolbar.delete': 'Удалить',
  'toolbar.enterSubgraph': 'Открыть подграф',
  'toolbar.exploreConnections': 'Показать связи',
  'toolbar.viewCode': 'Показать код',
  'inspector.empty': 'Выберите узел',
  'inspector.label': 'Название',
  'inspector.type': 'Тип',
  'inspector.category': 'Категория',
  'inspector.inputs': 'Входы',
  'inspector.outputs': 'Выходы',
  'inspector.controls': 'Элементы управления',
  'inspector.fire': 'Запустить',
  'inspector.subgraph': 'Подграф',
  'inspector.innerNodes': 'Внутренние узлы',
  'inspector.enterSubgraph': 'Открыть подграф',
  'templatePreview.placeholders': 'Плейсхолдеры',
  'templatePreview.empty': 'Введите {field} в шаблоне, чтобы добавить плейсхолдеры',
  'templatePreview.testData': 'Тестовые данные (JSON)',
  'templatePreview.preview': 'Предпросмотр',
  'context.deleteNode': 'Удалить узел',
  'context.cloneNode': 'Клонировать узел',
  'context.selectAll': 'Выбрать все',
  'context.deleteConnection': 'Удалить связь',
  'context.addNode': 'Добавить узел',
  'context.addComment': 'Добавить комментарий',
  'context.addFrame': 'Добавить фрейм',
  'context.paste': 'Вставить',
  'context.fitView': 'Вписать вид',
  'context.autoLayout': 'Автораскладка',
  'nodeCanvas.addNode': 'Добавить узел',
  'nodeCanvas.toggleMinimap': 'Переключить миникарту',
  'nodeSearch.placeholder': 'Поиск узлов...',
  'palette.title': 'Компоненты',
  'palette.searchPlaceholder': 'Поиск компонентов...',
  'tree.loading': 'Загрузка...',
  'tree.filterPlaceholder': 'Фильтр...',
  'tree.collapseAll': 'Свернуть все',
  'loading.label': 'Загрузка',
  'loading.initializing': 'Инициализация...',
  'eventFeed.title': 'События',
  'eventFeed.empty': 'Событий нет',
  'outputGraph.title': 'Граф',
  'outputGraph.empty': 'Нет данных графа',
  'outputGraph.truncated': 'Предпросмотр обрезан',
  'layout.collapse': 'Свернуть',
  'layout.fullscreen': 'Во весь экран',
  'layout.resetAll': 'Сбросить все раскладки',
  'tabs.close': 'Закрыть',
  'tabs.new': 'Новая вкладка',
  'tabs.home': 'Главная',
  'tabs.openProject': 'Открыть проект',
  'sourceViewer.showInGraph': 'Показать в графе',
  'sourceViewer.toggleViewMode': 'Переключить режим просмотра',
  'sourceViewer.graphLabel': 'граф',
});

const ES_MESSAGES = Object.freeze({
  'dialog.cancel': 'Cancelar',
  'dialog.confirm': 'Confirmar',
  'dialog.ok': 'OK',
  'networkApproval.title': 'Aprobación de red',
  'networkApproval.heading': 'Esperando aprobación local',
  'networkApproval.message': 'Este navegador de red debe aprobarse desde un navegador local ya autorizado.',
  'networkApproval.requestLabel': 'Solicitud',
  'networkApproval.addressLabel': 'Dirección',
  'networkApproval.waitingStatus': 'Esperando...',
  'networkApproval.approvedStatus': 'Aprobado. Abriendo...',
  'networkApproval.rejectedStatus': 'Rechazado desde el navegador local.',
  'quickOpen.placeholder': 'Buscar archivos...',
  'quickOpen.empty': 'No se encontraron archivos',
  'chat.composer.placeholder': 'Pregunta lo que quieras',
  'chat.list.title': 'Chats',
  'chat.list.new': 'Nuevo',
  'chat.list.empty': 'Aún no hay chats.',
  'chat.list.filter.all': 'Todos',
  'chat.list.filter.project': 'Por proyecto',
  'chat.list.filter.active': 'Activos',
  'chat.sidebar.new': 'Nuevo chat',
  'chat.sidebar.title': 'Chats',
  'chat.sidebar.delete': 'Eliminar',
  'chat.sidebar.deleteChat': 'Eliminar chat',
  'chat.sidebar.toggleChildren': 'Alternar chats secundarios',
  'chat.message.input': 'Entrada',
  'chat.message.result': 'Resultado',
  'chat.message.running': 'Ejecutando...',
  'chat.message.queued': 'En cola',
  'chat.message.item': 'Elemento',
  'chat.message.completed': 'Completado',
  'chat.message.failed': 'Falló',
  'chat.message.cancelled': 'Cancelado',
  'chat.message.copyResponse': 'Copiar respuesta',
  'chat.message.workedFor': 'Trabajó durante {elapsed}',
  'chat.message.thinkingFor': 'Pensando durante {elapsed}',
  'chat.meta.tokens': 'Tokens',
  'chat.meta.cost': 'Costo',
  'chat.meta.exit': 'salida {code}',
  'chat.meta.toolCall': '{count} llamada de herramienta',
  'chat.meta.toolCalls': '{count} llamadas de herramienta',
  'toolbar.duplicate': 'Duplicar',
  'toolbar.mute': 'Silenciar',
  'toolbar.delete': 'Eliminar',
  'toolbar.enterSubgraph': 'Entrar al subgrafo',
  'toolbar.exploreConnections': 'Explorar conexiones',
  'toolbar.viewCode': 'Ver código',
  'inspector.empty': 'Selecciona un nodo',
  'inspector.label': 'Etiqueta',
  'inspector.type': 'Tipo',
  'inspector.category': 'Categoría',
  'inspector.inputs': 'Entradas',
  'inspector.outputs': 'Salidas',
  'inspector.controls': 'Controles',
  'inspector.fire': 'Ejecutar',
  'inspector.subgraph': 'Subgrafo',
  'inspector.innerNodes': 'Nodos internos',
  'inspector.enterSubgraph': 'Entrar al subgrafo',
  'templatePreview.placeholders': 'Marcadores',
  'templatePreview.empty': 'Escribe {field} en la plantilla para agregar marcadores',
  'templatePreview.testData': 'Datos de prueba (JSON)',
  'templatePreview.preview': 'Vista previa',
  'context.deleteNode': 'Eliminar nodo',
  'context.cloneNode': 'Clonar nodo',
  'context.selectAll': 'Seleccionar todo',
  'context.deleteConnection': 'Eliminar conexión',
  'context.addNode': 'Agregar nodo',
  'context.addComment': 'Agregar comentario',
  'context.addFrame': 'Agregar marco',
  'context.paste': 'Pegar',
  'context.fitView': 'Ajustar vista',
  'context.autoLayout': 'Diseño automático',
  'nodeCanvas.addNode': 'Agregar nodo',
  'nodeCanvas.toggleMinimap': 'Alternar minimapa',
  'nodeSearch.placeholder': 'Buscar nodos...',
  'palette.title': 'Componentes',
  'palette.searchPlaceholder': 'Buscar componentes...',
  'tree.loading': 'Cargando...',
  'tree.filterPlaceholder': 'Filtrar...',
  'tree.collapseAll': 'Contraer todo',
  'loading.label': 'Cargando',
  'loading.initializing': 'Inicializando...',
  'eventFeed.title': 'Eventos',
  'eventFeed.empty': 'No hay eventos',
  'outputGraph.title': 'Grafo',
  'outputGraph.empty': 'No hay datos de grafo',
  'outputGraph.truncated': 'Vista previa truncada',
  'layout.collapse': 'Contraer',
  'layout.fullscreen': 'Pantalla completa',
  'layout.resetAll': 'Restablecer todos los diseños',
  'tabs.close': 'Cerrar',
  'tabs.new': 'Nueva pestaña',
  'tabs.home': 'Inicio',
  'tabs.openProject': 'Abrir proyecto',
  'sourceViewer.showInGraph': 'Mostrar en grafo',
  'sourceViewer.toggleViewMode': 'Alternar modo de vista',
  'sourceViewer.graphLabel': 'grafo',
});

export const LOCALE_CATALOGS = Object.freeze({
  en: EN_MESSAGES,
  ru: RU_MESSAGES,
  es: ES_MESSAGES,
});

export const LOCALE_CATALOG_KEYS = Object.freeze(Object.keys(EN_MESSAGES).sort());

let configuredLocale = DEFAULT_LOCALE;
let configuredLocaleMode = DEFAULT_LOCALE_MODE;
let configuredMessages = {};
let explicitlyConfiguredLocale = false;

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeMessages(messages = {}) {
  if (!isPlainObject(messages)) return {};
  let result = {};
  for (let [key, value] of Object.entries(messages)) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

function normalizeLocaleMessages(messages = {}) {
  if (!isPlainObject(messages)) return {};
  let result = {};
  for (let [key, value] of Object.entries(messages)) {
    let locale = normalizeLocale(key, { fallback: '' });
    if (!locale) continue;
    result[locale] = {
      ...(result[locale] || {}),
      ...normalizeMessages(value),
    };
  }
  return result;
}

export function normalizeLocale(value, options = {}) {
  let fallback = options.fallback ?? DEFAULT_LOCALE;
  if (value == null) return fallback;
  let tag = String(value).trim().toLowerCase().replaceAll('_', '-');
  if (!tag) return fallback;
  let base = tag.split('-')[0];
  return SUPPORTED_LOCALES.includes(base) ? base : fallback;
}

export function normalizeLocaleMode(value, options = {}) {
  let fallback = options.fallback ?? DEFAULT_LOCALE_MODE;
  if (value == null) return fallback;
  let tag = String(value).trim().toLowerCase().replaceAll('_', '-');
  if (!tag) return fallback;
  if (tag === DEFAULT_LOCALE_MODE) return DEFAULT_LOCALE_MODE;
  return normalizeLocale(tag, { fallback: '' }) || fallback;
}

export function resolveLocale(preferences, options = {}) {
  let fallback = normalizeLocale(options.fallback ?? DEFAULT_LOCALE);
  let values = Array.isArray(preferences) ? preferences : [preferences];
  for (let value of values) {
    let locale = normalizeLocale(value, { fallback: '' });
    if (locale) return locale;
  }
  return fallback;
}

export function resolveLocaleForMode(mode, preferences, options = {}) {
  let resolvedMode = normalizeLocaleMode(mode);
  if (resolvedMode === DEFAULT_LOCALE_MODE) {
    return resolveLocale(preferences, options);
  }
  return resolvedMode;
}

export function createLocaleDictionary(locale = DEFAULT_LOCALE, overrides = {}) {
  let resolvedLocale = normalizeLocale(locale);
  return {
    ...LOCALE_CATALOGS[DEFAULT_LOCALE],
    ...(LOCALE_CATALOGS[resolvedLocale] || {}),
    ...normalizeMessages(overrides),
  };
}

export function interpolateLocaleMessage(message, params = {}) {
  return String(message).replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match;
  });
}

export function createTranslator(options = {}) {
  let locale = normalizeLocale(options.locale ?? configuredLocale);
  let fallbackLocale = normalizeLocale(options.fallbackLocale ?? DEFAULT_LOCALE);
  let localeMessages = normalizeLocaleMessages(options.messages);
  let flatMessages = normalizeMessages(options.messages);
  let dictionary = {
    ...LOCALE_CATALOGS[fallbackLocale],
    ...(LOCALE_CATALOGS[locale] || {}),
    ...(configuredMessages[locale] || {}),
    ...(localeMessages[locale] || {}),
    ...flatMessages,
  };

  return (key, params = {}) => {
    let message = dictionary[key] ?? LOCALE_CATALOGS[fallbackLocale]?.[key] ?? key;
    return interpolateLocaleMessage(message, params);
  };
}

export function translate(key, params = {}, options = {}) {
  return createTranslator(options)(key, params);
}

export function configureLocalization(options = {}) {
  let nextMessages = normalizeLocaleMessages(options.messages);
  for (let [locale, messages] of Object.entries(nextMessages)) {
    configuredMessages[locale] = {
      ...(configuredMessages[locale] || {}),
      ...messages,
    };
  }

  let flatMessages = normalizeMessages(options.messages);
  if (Object.keys(flatMessages).length > 0) {
    configuredMessages[configuredLocale] = {
      ...(configuredMessages[configuredLocale] || {}),
      ...flatMessages,
    };
  }

  if (options.mode != null) {
    configuredLocaleMode = normalizeLocaleMode(options.mode);
    configuredLocale = resolveLocaleForMode(
      configuredLocaleMode,
      options.preferences ?? configuredLocale,
      { fallback: options.fallbackLocale ?? DEFAULT_LOCALE },
    );
    explicitlyConfiguredLocale = options.explicit ?? configuredLocaleMode !== DEFAULT_LOCALE_MODE;
  }

  if (options.locale != null) {
    configuredLocale = normalizeLocale(options.locale);
    configuredLocaleMode = configuredLocale;
    explicitlyConfiguredLocale = options.explicit !== false;
  }

  return getLocalization();
}

export function getLocalization() {
  let locale = configuredLocale;
  return {
    locale,
    mode: configuredLocaleMode,
    defaultLocale: DEFAULT_LOCALE,
    defaultMode: DEFAULT_LOCALE_MODE,
    supportedLocales: [...SUPPORTED_LOCALES],
    supportedModes: [...SUPPORTED_LOCALE_MODES],
    explicit: explicitlyConfiguredLocale,
    messages: createLocaleDictionary(locale, configuredMessages[locale]),
    t: createTranslator({ locale }),
  };
}

export function resetLocalization() {
  configuredLocale = DEFAULT_LOCALE;
  configuredLocaleMode = DEFAULT_LOCALE_MODE;
  configuredMessages = {};
  explicitlyConfiguredLocale = false;
  return getLocalization();
}

export function isLocalizationExplicit() {
  return explicitlyConfiguredLocale;
}

import css from './kanban-card-lab.css.js';
import '../board/KanbanCard/KanbanCard.js';
import { applyCascadeTheme } from '../themes/Theme.js';

applyCascadeTheme(document.documentElement, {
  mode: 'dark',
  themeVariant: 'modern',
  hue: 218,
  chroma: 35,
  bgLightness: 3,
  surfaceLightness: 7,
  contrast: 70,
  outline: 45,
  pattern: 0,
  radius: 17,
});

const strings = {
  ariaLabelDefault: 'Карточка:',
  nextAction: 'Далее:',
  stopCondition: 'Условие остановки',
  agentLocal: 'Локально',
  idleText: 'Нет активности',
  decisionProblem: 'Проблема',
  decisionQuestion: 'Что нужно решить?',
  retries: 'повтора'
};

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

const states = [
  {
    id: 1,
    model: { title: 'Исправить процесс оплаты', icon: 'dragDot' },
    view: { size: 'S', modules: ['header'] }
  },
  {
    id: 2,
    model: { 
      title: 'Исправить процесс оплаты',
      childRealization: { label: 'Подзадачи 3/5', current: 3, total: 5 }
    },
    view: { size: 'S', modules: ['header', 'childRealization'] }
  },
  {
    id: 3,
    model: {
      title: 'Исправить процесс оплаты',
      attention: { active: true, message: 'Нужно решение', tone: 'danger', layout: 'hero' }
    },
    view: { size: 'S', modules: ['header'] }
  },
  {
    id: 4,
    model: {
      title: 'Исправить процесс оплаты',
      dependencies: { blockedBy: 4, dependsOn: 2 }
    },
    view: { size: 'S', modules: ['dependencies', 'header'] }
  },
  {
    id: 5,
    model: {
      title: 'Исправить процесс оплаты',
      icon: 'grid',
      childRealization: { label: 'Подзадачи 3/5', current: 3, total: 5, tone: 'blue' },
      stages: [{ label: 'Критерии 4/5', current: 4, total: 5, tone: 'teal' }],
      agent: { name: 'Maya', local: true, accent: '#6A1B9A' }
    },
    view: { size: 'M', layout: 'split-progress', modules: ['header', 'childRealization', 'stages', 'agent'] }
  },
  {
    id: 6,
    model: {
      title: 'Исправить процесс оплаты',
      stages: [
        { label: 'Подзадачи 3/5', steps: [{status: 'done', label: '1'}, {status: 'done', label: '2'}, {status: 'active', label: '3'}, {status: 'pending', label: '4'}, {status: 'pending', label: '5'}] },
        { label: 'Критерии 4/5', current: 4, total: 5, tone: 'teal' }
      ]
    },
    view: { size: 'M', modules: ['header', 'stages'] }
  },
  {
    id: 7,
    model: {
      title: 'Исправить процесс оплаты',
      currentAction: 'Редактирует payment-service.js',
      nextAction: 'интеграционные тесты',
      idle: { time: '8 мин', alert: true },
      agent: { name: 'Orchestrator', local: true, accent: '#1565C0' }
    },
    view: { size: 'M', modules: ['header', 'currentAction', 'nextAction', 'idle', 'agent'] }
  },
  {
    id: 8,
    model: {
      title: 'Исправить процесс оплаты',
      agent: { name: 'QA', accent: '#E65100' },
      retries: 2,
      childRealization: { label: 'Подзадачи 3/5', current: 3, total: 5, tone: 'blue' },
      stages: [{ label: 'Критерии 4/5', current: 4, total: 5, tone: 'teal' }]
    },
    view: { size: 'M', layout: 'activity', modules: ['header', 'agent', 'retries', 'childRealization', 'stages'] }
  },
  {
    id: 9,
    model: {
      title: 'Исправить процесс оплаты',
      metric: { value: '$12.84', limit: 'лимит $20', meta: '64% бюджета использовано', progress: 64 },
      agent: { name: 'Maya', local: true, accent: '#6A1B9A' }
    },
    view: { size: 'L', modules: ['header', 'metric', 'agent'], primaryEmphasis: 'cost' }
  },
  {
    id: 10,
    model: {
      title: 'Исправить процесс оплаты',
      metric: { value: '6 420', unit: 'токенов', limit: 'из лимита 10 000 токенов', progress: 64 },
      agent: { name: 'Maya', local: true, accent: '#6A1B9A' }
    },
    view: { size: 'L', modules: ['header', 'metric', 'agent'], primaryEmphasis: 'tokens' }
  },
  {
    id: 11,
    model: {
      title: 'Исправить процесс оплаты',
      idle: { time: '8 мин', alert: true },
      retries: 2,
      agent: { name: 'Maya', local: true, accent: '#6A1B9A' }
    },
    view: { size: 'L', layout: 'activity', modules: ['header', 'idle', 'agent', 'retries'], primaryEmphasis: 'idle' }
  },
  {
    id: 12,
    model: {
      title: 'Исправить процесс оплаты',
      audit: { status: 'Аудит не пройден', summary: 'Условие остановки' },
      childRealization: { label: 'Подзадачи 3/5', current: 3, total: 5 },
      stages: [{ label: 'Критерии 4/5', current: 4, total: 5 }]
    },
    view: { size: 'L', layout: 'audit-progress', modules: ['header', 'audit', 'childRealization', 'stages'] }
  },
  {
    id: 13,
    model: {
      title: 'Исправить процесс оплаты',
      icon: 'flag',
      description: 'Снизить отказы на этапе оплаты\nи повысить конверсию успешных транзакций.',
      childRealization: {
        label: 'Прогресс идеи',
        steps: [
          { status: 'done', label: '' }, { status: 'done', label: '' }, { status: 'done', label: '' }, { status: 'done', label: '' },
          { status: 'active', label: '8' }, { status: 'pending', label: '12' }
        ]
      },
      stages: [{ label: '8 из 12 задач', current: 8, total: 12 }],
      agent: { name: 'Maya', local: true, accent: '#6A1B9A' }
    },
    view: { size: 'XL', modules: ['header', 'childRealization', 'stages', 'agent'] }
  },
  {
    id: 14,
    model: {
      title: 'Исправить процесс оплаты',
      currentAction: 'Редактирует payment-service.js',
      nextAction: 'интеграционные тесты',
      stopCondition: 'Все тесты пройдены и покрытие ≥ 80%',
      agent: { name: 'Maya', local: true, accent: '#6A1B9A' }
    },
    view: { size: 'XL', modules: ['header', 'currentAction', 'nextAction', 'stopCondition', 'agent'] }
  },
  {
    id: 15,
    model: {
      title: 'Исправить процесс оплаты',
      attention: { active: true, message: 'Нужно решение', tone: 'danger', layout: 'strip' },
      decision: {
        problem: 'Платеж не подтверждается при 3-D Secure.',
        question: 'Выбрать стратегию обработки ошибки и обновить логику повторов.'
      },
      actions: [
        { id: 'decide', label: 'Принять решение', tone: 'primary' },
        { id: 'comment', label: '', icon: 'messageSquare', tone: 'neutral' },
        { id: 'more', label: '', icon: 'moreHorizontal', tone: 'neutral' }
      ]
    },
    view: { size: 'XL', modules: ['header', 'decision', 'actions'] }
  },
  {
    id: 16,
    model: {
      title: 'Исправить процесс оплаты',
      dashboard: [
        { label: 'Бюджет', value: '$12.84', tone: 'blue', meta: 'лимит $20', progress: 64 },
        { label: 'Токены', value: '6 420', tone: 'teal', meta: 'из 10 000', progress: 64 },
        { label: 'Прогресс', meta: '3/5', current: 3, total: 5 },
        { label: 'Зависимости', value: 'Блокирует 4', meta: 'Зависит от 2', icon: 'link' },
        { label: 'Активность', value: '8 мин', meta: '2 повтора', icon: 'clock' },
        { label: 'Агент', value: 'Maya', meta: 'Локально', icon: 'user', tone: 'agent', accent: '#6A1B9A' }
      ]
    },
    view: { size: 'XL', modules: ['header', 'dashboard'], primaryEmphasis: 'dashboard' }
  }
];

window.addEventListener('load', () => {
  states.forEach(s => {
    let container = document.querySelector(`[data-state-id="${s.id}"]`);
    if (!container) return;
    container.dataset.size = s.view.size;
    container.dataset.stateIdFormatted = s.id < 10 ? '0' + s.id : s.id;
    let card = container.querySelector('sn-kanban-card');
    if (card) {
      card.setView({ ...s.view, strings });
      card.setCard(s.model);
    }
  });
});

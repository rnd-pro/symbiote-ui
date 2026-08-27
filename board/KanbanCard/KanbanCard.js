import { Symbiote } from '@symbiotejs/symbiote';
import template from './KanbanCard.tpl.js';
import rootStyles from './KanbanCard.css.js';
import { Icons } from './icons.js';

const ALL_MODULES = [
  'attention', 'header', 'dependencies', 'childRealization', 'stages',
  'currentAction', 'nextAction', 'stopCondition', 'agent', 'retries', 'idle',
  'metric', 'audit', 'decision', 'dashboard', 'actions',
];

const STEP_STATUSES = new Set(['done', 'active', 'pending']);
const ATTENTION_TONES = new Set(['danger', 'warning', 'info', 'success', 'neutral']);
const ATTENTION_LAYOUTS = new Set(['strip', 'hero']);
const HEX_COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
const ATTENTION_ICONS = {
  danger: 'alertTriangle',
  warning: 'alertTriangle',
  info: 'dot',
  success: 'checkCircle',
  neutral: 'dot',
};

function normalizeAccent(value) {
  let accent = String(value || '').trim();
  return HEX_COLOR.test(accent) ? accent : '';
}

function createStepper(steps) {
  let stepper = document.createElement('div');
  stepper.className = 'sn-kc-stepper';

  for (let step of steps) {
    let stepDiv = document.createElement('div');
    let status = STEP_STATUSES.has(step.status) ? step.status : 'pending';
    stepDiv.className = 'sn-kc-step';
    stepDiv.dataset.status = status;

    if (status === 'done') {
      stepDiv.innerHTML = Icons.checkCircle;
    } else {
      stepDiv.textContent = step.label || '';
    }

    stepper.appendChild(stepDiv);
  }

  return stepper;
}

function createProgressTrack(stage) {
  if (stage.steps && stage.steps.length) return createStepper(stage.steps);

  let progress = stage.progress != null
    ? stage.progress
    : stage.total
      ? Math.round((stage.current / stage.total) * 100)
      : 0;
  let track = document.createElement('div');
  track.className = 'sn-kc-progress-track';
  track.dataset.tone = stage.tone;

  if (stage.total && stage.current != null) {
    track.className = 'sn-kc-segmented-track';
    for (let i = 0; i < stage.total; i++) {
      let segment = document.createElement('div');
      segment.className = 'sn-kc-segment';
      if (i < stage.current) segment.classList.add('sn-kc-segment-active');
      track.appendChild(segment);
    }
    return track;
  }

  let bar = document.createElement('div');
  bar.className = 'sn-kc-progress-bar';
  bar.style.width = progress + '%';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuenow', String(progress));
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  track.appendChild(bar);
  return track;
}

function createProgressStage(stage) {
  let stageElement = document.createElement('div');
  stageElement.className = 'sn-kc-stage';

  let header = document.createElement('div');
  header.className = 'sn-kc-stage-header';

  let label = document.createElement('span');
  label.textContent = stage.label || '';
  header.appendChild(label);

  if (!(stage.steps && stage.steps.length)) {
    let countText = stage.current != null ? `${stage.current}/${stage.total}` : '';
    let count = document.createElement('span');
    count.textContent = countText;
    if (countText && !String(stage.label || '').trim().endsWith(countText)) {
      header.appendChild(count);
    }
  }

  stageElement.append(header, createProgressTrack(stage));
  return stageElement;
}

export function normalizeKanbanCardModel(model) {
  if (!model) model = {};
  
  let clamp = (v) => {
    if (v == null || isNaN(v) || v === '') return null;
    return Math.max(0, Math.min(100, Number(v)));
  };
  
  let safeCloneSteps = (steps) => {
    if (!Array.isArray(steps)) return null;
    return steps.map(step => ({
      label: String(step.label || ''),
      status: String(step.status || '')
    }));
  };

  return {
    id: String(model.id || ''),
    columnId: String(model.columnId || ''),
    title: String(model.title || ''),
    description: String(model.description || ''),
    icon: String(model.icon || ''),
    ariaLabel: model.ariaLabel != null ? String(model.ariaLabel) : null,
    
    attention: model.attention ? {
      active: !!model.attention.active,
      message: String(model.attention.message || ''),
      tone: ATTENTION_TONES.has(model.attention.tone) ? model.attention.tone : 'danger',
      layout: ATTENTION_LAYOUTS.has(model.attention.layout) ? model.attention.layout : 'strip',
      icon: String(model.attention.icon || '')
    } : null,
    
    stages: Array.isArray(model.stages) ? model.stages.map(s => ({
      label: String(s.label || ''),
      current: s.current != null ? Number(s.current) : null,
      total: s.total != null ? Number(s.total) : null,
      steps: safeCloneSteps(s.steps),
      progress: clamp(s.progress),
      tone: String(s.tone || 'neutral')
    })) : [],
    
    metric: model.metric ? {
      tone: String(model.metric.tone || 'neutral'),
      value: String(model.metric.value || ''),
      unit: String(model.metric.unit || ''),
      limit: String(model.metric.limit || ''),
      progress: clamp(model.metric.progress),
      meta: String(model.metric.meta || '')
    } : null,
    
    dependencies: model.dependencies ? {
      text: String(model.dependencies.text || ''),
      blockedBy: Number(model.dependencies.blockedBy || 0),
      dependsOn: Number(model.dependencies.dependsOn || 0),
    } : null,
    
    childRealization: model.childRealization ? {
      label: String(model.childRealization.label || ''),
      current: Number(model.childRealization.current || 0),
      total: Number(model.childRealization.total || 0),
      progress: clamp(model.childRealization.progress),
      steps: safeCloneSteps(model.childRealization.steps),
      tone: String(model.childRealization.tone || 'neutral')
    } : null,
    
    audit: model.audit ? {
      status: String(model.audit.status || 'neutral'),
      summary: String(model.audit.summary || '')
    } : null,
    
    currentAction: String(model.currentAction || ''),
    nextAction: String(model.nextAction || ''),
    stopCondition: String(model.stopCondition || ''),
    
    agent: model.agent ? {
      name: String(model.agent.name || ''),
      local: !!model.agent.local,
      icon: String(model.agent.icon || 'user'),
      accent: normalizeAccent(model.agent.accent),
      provider: String(model.agent.provider || ''),
      model: String(model.agent.model || ''),
    } : null,
    
    retries: model.retries != null ? Number(model.retries) : null,
    
    idle: model.idle ? {
      time: String(model.idle.time || ''),
      alert: !!model.idle.alert
    } : null,
    
    decision: model.decision ? {
      problem: String(model.decision.problem || ''),
      question: String(model.decision.question || '')
    } : null,
    
    dashboard: Array.isArray(model.dashboard) ? model.dashboard.map(d => ({
      label: String(d.label || ''),
      value: String(d.value || ''),
      icon: String(d.icon || ''),
      tone: String(d.tone || 'neutral'),
      meta: String(d.meta || ''),
      progress: clamp(d.progress),
      current: d.current != null ? Number(d.current) : null,
      total: d.total != null ? Number(d.total) : null,
      steps: safeCloneSteps(d.steps),
      accent: normalizeAccent(d.accent)
    })) : null,
    
    actions: Array.isArray(model.actions) ? model.actions.map(a => ({
      id: String(a.id || ''),
      label: String(a.label || ''),
      tone: String(a.tone || 'primary'),
      icon: String(a.icon || ''),
      disabled: !!a.disabled,
      title: a.title != null ? String(a.title) : ''
    })) : [],
    
    selected: !!model.selected
  };
}

export function normalizeKanbanCardView(view) {
  if (!view) view = {};
  
  let modules = Array.isArray(view.modules) 
    ? Array.from(new Set(view.modules.filter(m => ALL_MODULES.includes(m))))
    : ['header'];
    
  const validSizes = ['S', 'M', 'L', 'XL'];
  const validEmphasis = ['', 'cost', 'tokens', 'idle', 'dashboard'];
  
  let size = String(view.size || 'M').toUpperCase();
  if (!validSizes.includes(size)) size = 'M';
  
  let primaryEmphasis = String(view.primaryEmphasis || '');
  if (!validEmphasis.includes(primaryEmphasis)) primaryEmphasis = '';
  
  const validLayouts = ['default', 'split-progress', 'activity', 'audit-progress'];
  let layout = String(view.layout || 'default');
  if (!validLayouts.includes(layout)) layout = 'default';
    
  let strings = view.strings || {};

  return {
    modules,
    primaryEmphasis,
    size,
    layout,
    strings: {
      ariaLabelDefault: String(strings.ariaLabelDefault || ''),
      nextAction: String(strings.nextAction || ''),
      stopCondition: String(strings.stopCondition || ''),
      agentLocal: String(strings.agentLocal || ''),
      idleText: String(strings.idleText || ''),
      decisionProblem: String(strings.decisionProblem || ''),
      decisionQuestion: String(strings.decisionQuestion || ''),
      retries: String(strings.retries || '')
    }
  };
}

export class KanbanCard extends Symbiote {
  #card = normalizeKanbanCardModel({});
  #view = normalizeKanbanCardView({});
  
  init$ = {
    size: 'M',
    selected: false,
    primaryEmphasis: '',
    layout: 'default',
    ariaLabel: '',
    
    onSelect: (e) => {
      this.dispatchEvent(new CustomEvent('sn-kanban-card-select', {
        bubbles: true,
        composed: true,
        detail: { card: this.getCard() }
      }));
    },
    
    onAction: (e) => {
      e.stopPropagation();
      let btn = e.target.closest('[data-action-id]') || e.target;
      let actionId = btn.getAttribute('data-action-id');
      if (actionId) {
        let actionModel = this.#card.actions.find(a => String(a.id) === actionId);
        if (!actionModel || actionModel.disabled) return;
        this.dispatchEvent(new CustomEvent('sn-kanban-card-action', {
          bubbles: true,
          composed: true,
          detail: { 
            actionId, 
            actionModel: actionModel ? { ...actionModel } : null,
            card: this.getCard() 
          }
        }));
      }
    }
  };

  setCard(card) {
    this.#card = normalizeKanbanCardModel(card);
    this.#syncToState();
    this.#renderModules();
  }

  getCard() {
    return normalizeKanbanCardModel(this.#card);
  }
  
  setView(view) {
    this.#view = normalizeKanbanCardView(view);
    this.#syncToState();
    this.#renderModules();
  }
  
  getView() {
    let view = normalizeKanbanCardView(this.#view);
    if (this.#card.attention && this.#card.attention.active) {
      view.modules = ['attention', ...view.modules.filter(m => m !== 'attention')];
    }
    return view;
  }

  #syncToState() {
    let $ = this.$;
    let c = this.#card;
    let v = this.getView();
    
    $.size = v.size;
    $.selected = c.selected;
    $.primaryEmphasis = v.primaryEmphasis;
    $.layout = v.layout;
    $.ariaLabel = c.ariaLabel || (c.title ? `${v.strings.ariaLabelDefault} ${c.title}`.trim() : v.strings.ariaLabelDefault);
    
    this.dataset.size = $.size;
    this.dataset.layout = $.layout;
    if ($.selected) this.setAttribute('selected', '');
    else this.removeAttribute('selected');
    if ($.primaryEmphasis) this.dataset.primaryEmphasis = $.primaryEmphasis;
    else delete this.dataset.primaryEmphasis;
    if (c.attention && c.attention.active) this.dataset.hasAttention = 'true';
    else delete this.dataset.hasAttention;
    if (c.attention && c.attention.active) this.dataset.attentionTone = c.attention.tone;
    else delete this.dataset.attentionTone;
  }

  #renderModules() {
    if (!this.ref || !this.ref.content) return;
    
    let v = this.getView();
    let order = new Set(v.modules);
    
    for (let m of ALL_MODULES) {
      if (this.ref[m + 'Module']) {
        this.ref[m + 'Module'].hidden = !order.has(m);
      }
    }
    
    for (let mod of order) {
      if (this.ref[mod + 'Module']) {
        this.ref.content.appendChild(this.ref[mod + 'Module']);
      }
    }
    
    this.#renderModuleContent();
  }
  
  #renderModuleContent() {
    let c = this.#card;
    let ref = this.ref;
    
    if (ref.headerModule) {
      ref.headerTitle.textContent = c.title;
      ref.headerDesc.textContent = c.description;
      ref.headerDesc.hidden = !c.description;
      let headerIcon = Icons[c.icon] || '';
      ref.headerIcon.hidden = !headerIcon;
      ref.headerIcon.innerHTML = headerIcon;
      if (headerIcon) ref.headerIcon.dataset.icon = c.icon;
      else delete ref.headerIcon.dataset.icon;
    }
    
    if (ref.attentionModule && c.attention) {
      ref.attentionText.textContent = c.attention.message;
      ref.attentionModule.dataset.attentionLayout = c.attention.layout;
      ref.attentionModule.dataset.tone = c.attention.tone;
      let attentionIcon = Icons[c.attention.icon] || Icons[ATTENTION_ICONS[c.attention.tone]];
      ref.attentionIcon.innerHTML = attentionIcon || '';
    }
    
    if (ref.dependenciesModule && c.dependencies) {
      let b = c.dependencies.blockedBy;
      let d = c.dependencies.dependsOn;
      let text = [];
      if (b) text.push(`Блокирует ${b}`);
      if (d) text.push(`Зависит от ${d}`);
      ref.dependenciesText.textContent = c.dependencies.text || text.join(' • ');
    }
    
    if (ref.stagesModule && c.stages.length) {
      ref.stagesContainer.textContent = '';
      for (let s of c.stages) {
        ref.stagesContainer.appendChild(createProgressStage(s));
      }
    }
    
    if (ref.childRealizationModule && c.childRealization) {
      ref.childRealizationContainer.textContent = '';
      ref.childRealizationContainer.appendChild(createProgressStage(c.childRealization));
    }
    
    if (ref.metricModule && c.metric) {
      ref.metricValue.textContent = c.metric.value;
      ref.metricUnit.textContent = c.metric.unit;
      ref.metricMeta.textContent = c.metric.meta;
      if (c.metric.progress != null) {
        ref.metricProgress.hidden = false;
        ref.metricProgressBar.style.width = c.metric.progress + '%';
        ref.metricProgressBar.setAttribute('role', 'progressbar');
        ref.metricProgressBar.setAttribute('aria-valuenow', String(c.metric.progress));
        ref.metricProgressBar.setAttribute('aria-valuemin', '0');
        ref.metricProgressBar.setAttribute('aria-valuemax', '100');
      } else {
        ref.metricProgress.hidden = true;
      }
      if (c.metric.limit) {
        ref.metricLimit.hidden = false;
        ref.metricLimit.textContent = c.metric.limit;
      } else {
        ref.metricLimit.hidden = true;
      }
    }
    
    if (ref.currentActionModule) {
      ref.currentActionText.textContent = c.currentAction;
    }
    
    if (ref.nextActionModule) {
      if (ref.nextActionLabel) ref.nextActionLabel.textContent = this.#view.strings.nextAction;
      ref.nextActionText.textContent = c.nextAction;
    }
    
    if (ref.stopConditionModule) {
      if (ref.stopConditionLabel) ref.stopConditionLabel.textContent = this.#view.strings.stopCondition;
      ref.stopConditionText.textContent = c.stopCondition;
    }
    
    if (ref.agentModule && c.agent) {
      ref.agentName.textContent = c.agent.name;
      ref.agentName.hidden = !c.agent.name;
      if (ref.agentLocalText) ref.agentLocalText.textContent = this.#view.strings.agentLocal;
      ref.agentLocal.hidden = !c.agent.local;
      ref.agentProviderText.textContent = c.agent.provider;
      ref.agentProvider.hidden = !c.agent.provider;
      ref.agentProvider.title = c.agent.model;
      ref.agentDivider.hidden = !(c.agent.name && (c.agent.local || c.agent.provider));
      ref.agentIcon.innerHTML = Icons[c.agent.icon] || Icons.user;
      if (c.agent.accent) ref.agentModule.style.setProperty('--sn-kanban-card-agent-accent', c.agent.accent);
      else ref.agentModule.style.removeProperty('--sn-kanban-card-agent-accent');
    }
    
    if (ref.retriesModule && c.retries != null) {
      ref.retriesText.textContent = `${c.retries}${this.#view.strings.retries ? ' ' + this.#view.strings.retries : ''}`.trim();
    }
    
    if (ref.idleModule && c.idle) {
      if (ref.idleText) ref.idleText.textContent = this.#view.strings.idleText;
      ref.idleTime.textContent = c.idle.time;
      ref.idleModule.dataset.alert = c.idle.alert ? 'true' : 'false';
    }
    
    if (ref.auditModule && c.audit) {
      ref.auditStatus.textContent = c.audit.status;
      ref.auditSummary.textContent = c.audit.summary;
    }
    
    if (ref.decisionModule && c.decision) {
      if (ref.decisionProblemLabel) ref.decisionProblemLabel.textContent = this.#view.strings.decisionProblem;
      ref.decisionProblem.textContent = c.decision.problem;
      if (ref.decisionQuestionLabel) ref.decisionQuestionLabel.textContent = this.#view.strings.decisionQuestion;
      ref.decisionQuestion.textContent = c.decision.question;
    }
    
    if (ref.dashboardModule && c.dashboard) {
      ref.dashboardContainer.textContent = '';
      for (let d of c.dashboard) {
        let item = document.createElement('div');
        item.className = 'sn-kc-dash-item';
        if (d.tone) item.dataset.tone = d.tone;
        if (d.accent) item.style.setProperty('--sn-kanban-card-agent-accent', d.accent);
        if (d.icon && Icons[d.icon]) {
          let ic = document.createElement('div');
          ic.className = 'sn-kc-dash-icon';
          ic.innerHTML = Icons[d.icon];
          item.appendChild(ic);
        }
        let content = document.createElement('div');
        content.className = 'sn-kc-dash-content';
        let lbl = document.createElement('div');
        lbl.className = 'sn-kc-dash-label';
        lbl.textContent = d.label;
        content.appendChild(lbl);
        if (d.value) {
          let val = document.createElement('div');
          val.className = 'sn-kc-dash-val';
          val.textContent = d.value;
          content.appendChild(val);
        }
        if (d.meta) {
          let meta = document.createElement('div');
          meta.className = 'sn-kc-metric-meta';
          meta.textContent = d.meta;
          content.appendChild(meta);
        }
        if (d.total && d.current != null) {
          let track = document.createElement('div');
          track.className = 'sn-kc-segmented-track';
          for (let i = 0; i < d.total; i++) {
            let segment = document.createElement('div');
            segment.className = 'sn-kc-segment';
            if (i < d.current) segment.classList.add('sn-kc-segment-active');
            track.appendChild(segment);
          }
          content.appendChild(track);
        } else if (d.progress != null) {
          let track = document.createElement('div');
          track.className = 'sn-kc-progress-track';
          let bar = document.createElement('div');
          bar.className = 'sn-kc-progress-bar';
          bar.style.width = d.progress + '%';
          bar.setAttribute('role', 'progressbar');
          bar.setAttribute('aria-valuenow', String(d.progress));
          bar.setAttribute('aria-valuemin', '0');
          bar.setAttribute('aria-valuemax', '100');
          track.appendChild(bar);
          content.appendChild(track);
        }
        if (d.steps && d.steps.length) {
          content.appendChild(createStepper(d.steps));
        }
        item.appendChild(content);
        ref.dashboardContainer.appendChild(item);
      }
    }
    
    if (ref.actionsModule && c.actions.length) {
      ref.actionsContainer.textContent = '';
      for (let a of c.actions) {
        let btn = document.createElement('button');
        btn.className = 'sn-kc-action-btn';
        btn.dataset.actionId = a.id;
        btn.dataset.tone = a.tone;
        
        if (a.icon && Icons[a.icon]) {
          let ic = document.createElement('span');
          ic.className = 'sn-kc-action-icon';
          ic.innerHTML = Icons[a.icon];
          btn.appendChild(ic);
        }
        if (a.disabled) {
          btn.disabled = true;
          btn.setAttribute('aria-disabled', 'true');
        }
        if (a.title) {
          btn.title = a.title;
        }
        btn.appendChild(document.createTextNode(a.label));
        ref.actionsContainer.appendChild(btn);
      }
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.#renderModules();
  }
}

KanbanCard.template = template;
KanbanCard.rootStyles = rootStyles;
KanbanCard.reg('sn-kanban-card');

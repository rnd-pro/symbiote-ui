import { html } from '@symbiotejs/symbiote';
import { Icons } from './icons.js';

export default html`
  <button class="sn-kc-selector" tabindex="0" ${{ 'onclick': 'onSelect', '@aria-label': 'ariaLabel' }}>
    ${Icons.dragGrip}
  </button>
  
  <div class="sn-kc-content" ref="content">
    <div class="sn-kc-module sn-kc-attention" ref="attentionModule" hidden>
      <span class="sn-kc-attention-icon" ref="attentionIcon">${Icons.alertTriangle}</span>
      <span ref="attentionText"></span>
      <span class="sn-kc-header-menu">${Icons.moreHorizontal}</span>
    </div>
    
    <div class="sn-kc-module sn-kc-header" ref="headerModule" hidden>
      <div class="sn-kc-header-top">
        <span class="sn-kc-header-icon" ref="headerIcon" hidden></span>
        <span class="sn-kc-header-title" ref="headerTitle"></span>
        <span class="sn-kc-header-menu">${Icons.moreHorizontal}</span>
      </div>
      <div class="sn-kc-header-desc" ref="headerDesc" hidden></div>
    </div>
    
    <div class="sn-kc-module sn-kc-child-realization" ref="childRealizationModule" hidden>
      <div ref="childRealizationContainer" class="sn-kc-stages-list"></div>
    </div>
    
    <div class="sn-kc-module sn-kc-stages" ref="stagesModule" hidden>
      <div ref="stagesContainer" class="sn-kc-stages-list"></div>
    </div>
    
    <div class="sn-kc-module sn-kc-dependencies" ref="dependenciesModule" hidden>
      <span class="sn-kc-dependencies-icon">${Icons.link}</span>
      <span class="sn-kc-dependencies-text" ref="dependenciesText"></span>
    </div>
    
    <div class="sn-kc-module sn-kc-current-action" ref="currentActionModule" hidden>
      <span class="sn-kc-ca-icon">${Icons.code}</span>
      <span ref="currentActionText"></span>
    </div>
    
    <div class="sn-kc-module sn-kc-next-action" ref="nextActionModule" hidden>
      <span class="sn-kc-na-label" ref="nextActionLabel"></span>
      <span ref="nextActionText"></span>
      <span class="sn-kc-na-icon">${Icons.arrow}</span>
    </div>
    
    <div class="sn-kc-module sn-kc-stop-condition" ref="stopConditionModule" hidden>
      <div class="sn-kc-stop-label" ref="stopConditionLabel"></div>
      <div class="sn-kc-stop-text" ref="stopConditionText"></div>
    </div>
    
    <div class="sn-kc-module sn-kc-metric" ref="metricModule" hidden>
      <div class="sn-kc-metric-main">
        <span class="sn-kc-metric-value" ref="metricValue"></span>
        <span class="sn-kc-metric-unit" ref="metricUnit"></span>
      </div>
      <div class="sn-kc-metric-limit" ref="metricLimit" hidden></div>
      <div class="sn-kc-progress-track" ref="metricProgress" hidden>
        <div class="sn-kc-progress-bar" ref="metricProgressBar"></div>
      </div>
      <div class="sn-kc-metric-meta" ref="metricMeta"></div>
    </div>
    
    <div class="sn-kc-module sn-kc-agent" ref="agentModule" hidden>
      <span class="sn-kc-agent-icon" ref="agentIcon">${Icons.user}</span>
      <span class="sn-kc-agent-name" ref="agentName"></span>
      <div class="sn-kc-agent-divider" ref="agentDivider"></div>
      <span class="sn-kc-agent-provider" ref="agentProvider" hidden>${Icons.code} <span ref="agentProviderText"></span></span>
      <span class="sn-kc-agent-local" ref="agentLocal" hidden>${Icons.monitor} <span ref="agentLocalText"></span></span>
    </div>
    
    <div class="sn-kc-module sn-kc-retries" ref="retriesModule" hidden>
      <span class="sn-kc-retries-icon">${Icons.retry}</span>
      <span class="sn-kc-retries-text" ref="retriesText"></span>
    </div>
    
    <div class="sn-kc-module sn-kc-idle" ref="idleModule" hidden>
      <span class="sn-kc-idle-icon">${Icons.clock}</span>
      <span class="sn-kc-idle-text" ref="idleText"></span>
      <span class="sn-kc-idle-time" ref="idleTime"></span>
    </div>
    
    <div class="sn-kc-module sn-kc-audit" ref="auditModule" hidden>
      <span class="sn-kc-audit-icon">${Icons.shieldAlert}</span>
      <div class="sn-kc-audit-content">
        <div class="sn-kc-audit-status" ref="auditStatus"></div>
        <div class="sn-kc-audit-summary" ref="auditSummary"></div>
      </div>
    </div>
    
    <div class="sn-kc-module sn-kc-decision" ref="decisionModule" hidden>
      <div class="sn-kc-decision-problem-label" ref="decisionProblemLabel"></div>
      <div class="sn-kc-decision-problem" ref="decisionProblem"></div>
      <div class="sn-kc-decision-question-label" ref="decisionQuestionLabel"></div>
      <div class="sn-kc-decision-question" ref="decisionQuestion"></div>
    </div>
    
    <div class="sn-kc-module sn-kc-dashboard" ref="dashboardModule" hidden>
      <div class="sn-kc-dashboard-grid" ref="dashboardContainer"></div>
    </div>
    
    <div class="sn-kc-module sn-kc-actions" ref="actionsModule" hidden ${{ 'onclick': 'onAction' }}>
      <div class="sn-kc-actions-list" ref="actionsContainer"></div>
    </div>
  </div>
`;

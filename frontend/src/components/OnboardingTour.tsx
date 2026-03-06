import React, { useState, useEffect } from 'react';
import './OnboardingTour.css';

interface TourStep {
  target: string; // CSS selector for the target element
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '.watchlist-panel',
    title: '自选股列表',
    content: '在这里管理您关注的股票。点击"+"按钮添加新股票，拖拽可以调整顺序。',
    position: 'right',
  },
  {
    target: '.stock-search',
    title: '股票搜索',
    content: '输入股票代码或名称快速搜索。支持模糊匹配，让您轻松找到目标股票。',
    position: 'bottom',
  },
  {
    target: '.market-overview',
    title: '市场概览',
    content: '实时查看主要指数行情、涨跌榜和市场热力图，把握市场整体走势。',
    position: 'bottom',
  },
  {
    target: '.news-feed',
    title: '新闻资讯',
    content: '聚合多个来源的财经新闻，AI 自动分析新闻对股价的潜在影响。',
    position: 'left',
  },
  {
    target: '.notification-btn',
    title: '消息通知',
    content: '接收价格提醒、财报发布、内部交易等重要事件的实时推送。',
    position: 'bottom',
  },
  {
    target: '.ai-assistant-btn',
    title: 'AI 智能助手',
    content: '与 AI 助手对话，快速管理自选股、分析股票、总结新闻动态。',
    position: 'left',
  },
];

const OnboardingTour: React.FC<OnboardingTourProps> = ({ isOpen, onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isOpen) return;

    const step = TOUR_STEPS[currentStep];
    const targetElement = document.querySelector(step.target);

    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const style: React.CSSProperties = {};

      switch (step.position) {
        case 'top':
          style.left = rect.left + rect.width / 2;
          style.top = rect.top - 10;
          style.transform = 'translate(-50%, -100%)';
          break;
        case 'bottom':
          style.left = rect.left + rect.width / 2;
          style.top = rect.bottom + 10;
          style.transform = 'translateX(-50%)';
          break;
        case 'left':
          style.left = rect.left - 10;
          style.top = rect.top + rect.height / 2;
          style.transform = 'translate(-100%, -50%)';
          break;
        case 'right':
          style.left = rect.right + 10;
          style.top = rect.top + rect.height / 2;
          style.transform = 'translateY(-50%)';
          break;
      }

      setTooltipStyle(style);

      // 高亮目标元素
      targetElement.classList.add('tour-highlight');

      return () => {
        targetElement.classList.remove('tour-highlight');
      };
    }
  }, [isOpen, currentStep]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <div className="onboarding-tour">
      <div className="tour-overlay" onClick={onSkip} />
      
      <div className="tour-tooltip" style={tooltipStyle}>
        <div className="tooltip-header">
          <h4>{step.title}</h4>
          <button className="close-btn" onClick={onSkip}>×</button>
        </div>
        
        <div className="tooltip-content">
          <p>{step.content}</p>
        </div>
        
        <div className="tooltip-footer">
          <div className="step-indicator">
            {TOUR_STEPS.map((_, index) => (
              <span
                key={index}
                className={`step-dot ${index === currentStep ? 'active' : ''}`}
              />
            ))}
          </div>
          
          <div className="tooltip-actions">
            {currentStep > 0 && (
              <button className="prev-btn" onClick={handlePrev}>
                上一步
              </button>
            )}
            <button className="next-btn" onClick={handleNext}>
              {currentStep === TOUR_STEPS.length - 1 ? '完成' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;

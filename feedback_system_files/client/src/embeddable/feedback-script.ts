/**
 * Embeddable Feedback Widget
 * 
 * This script creates a standalone widget that can be embedded on any website
 * to collect user feedback. It allows users to click on elements and add
 * targeted feedback with element highlighting.
 */

(() => {
  class FeedbackWidget {
    private apiUrl: string;
    private projectId: string;
    private widget: HTMLElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private isOpen = false;
    private isTargeting = false;
    private selectedElement: HTMLElement | null = null;
    private hoveredElement: HTMLElement | null = null;
    private elementPath: string | null = null;
    private coordinates: {x: number, y: number} | null = null;
    
    constructor(config: {
      apiUrl: string;
      projectId: string;
      position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    }) {
      this.apiUrl = config.apiUrl;
      this.projectId = config.projectId;
      
      // Create widget with Shadow DOM
      this.createWidget(config.position || 'bottom-right');
      
      // Initialize event listeners
      this.initEventListeners();
    }
    
    private injectStyles() {
      // Only inject styles into shadow DOM
      if (!this.shadowRoot) return;
      
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        .fb-widget-container {
          position: fixed;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
        }
        .fb-widget-container.bottom-right { bottom: 20px; right: 20px; }
        .fb-widget-container.bottom-left { bottom: 20px; left: 20px; }
        .fb-widget-container.top-right { top: 20px; right: 20px; }
        .fb-widget-container.top-left { top: 20px; left: 20px; }
        
        .fb-trigger-button {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: #3b82f6;
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s;
        }
        .fb-trigger-button:hover {
          transform: scale(1.05);
        }
        
        .fb-card {
          position: absolute;
          bottom: 60px;
          right: 0;
          width: 320px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          display: none;
        }
        
        .fb-card-header {
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .fb-card-title {
          font-weight: 600;
          font-size: 16px;
          margin: 0;
        }
        
        .fb-close-button {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }
        
        .fb-card-body {
          padding: 16px;
        }
        
        .fb-form-group {
          margin-bottom: 16px;
        }
        
        .fb-label {
          display: block;
          font-weight: 500;
          margin-bottom: 6px;
          font-size: 14px;
        }
        
        .fb-input, .fb-textarea, .fb-select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .fb-textarea {
          min-height: 100px;
          resize: vertical;
        }
        
        .fb-button {
          background-color: #3b82f6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          width: 100%;
        }
        
        .fb-button-outline {
          background-color: white;
          color: #3b82f6;
          border: 1px solid #3b82f6;
        }
        
        .fb-error {
          color: #ef4444;
          font-size: 12px;
          margin-top: 4px;
        }
        
        .fb-selected-element {
          background-color: #f3f4f6;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          margin-bottom: 12px;
          word-break: break-all;
        }
        
        .fb-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 9998;
          display: none;
        }
        
        .fb-targeting-info {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          max-width: 400px;
          text-align: center;
          z-index: 10000;
        }
      `;
      this.shadowRoot.appendChild(styleElement);
    }
    
    private createWidget(position: string) {
      // Create host container
      const hostContainer = document.createElement('div');
      hostContainer.id = 'feedback-widget-host';
      
      // Create shadow DOM
      const shadowRoot = hostContainer.attachShadow({ mode: 'closed' });
      this.shadowRoot = shadowRoot;
      
      // Create container inside shadow DOM
      const container = document.createElement('div');
      container.className = `fb-widget-container ${position}`;
      
      // Inject styles into shadow DOM
      this.injectStyles();
      
      // Create trigger button
      const triggerButton = document.createElement('button');
      triggerButton.className = 'fb-trigger-button';
      triggerButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      triggerButton.addEventListener('click', () => this.toggleWidget());
      container.appendChild(triggerButton);
      
      // Create feedback card
      const card = document.createElement('div');
      card.className = 'fb-card';
      
      // Card header
      const header = document.createElement('div');
      header.className = 'fb-card-header';
      
      const title = document.createElement('h3');
      title.className = 'fb-card-title';
      title.textContent = 'Submit Feedback';
      
      const closeButton = document.createElement('button');
      closeButton.className = 'fb-close-button';
      closeButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      closeButton.addEventListener('click', () => this.toggleWidget(false));
      
      header.appendChild(title);
      header.appendChild(closeButton);
      card.appendChild(header);
      
      // Card body with form
      const body = document.createElement('div');
      body.className = 'fb-card-body';
      
      body.innerHTML = `
        <form id="fb-feedback-form">
          <div class="fb-form-group">
            <label class="fb-label" for="fb-title">Title</label>
            <input class="fb-input" type="text" id="fb-title" name="title" placeholder="Brief description of the issue" required>
          </div>
          
          <div class="fb-form-group">
            <label class="fb-label" for="fb-description">Description</label>
            <textarea class="fb-textarea" id="fb-description" name="description" placeholder="Detailed explanation of the feedback" required></textarea>
          </div>
          
          <div class="fb-form-group">
            <label class="fb-label" for="fb-priority">Priority</label>
            <select class="fb-select" id="fb-priority" name="priority">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          
          <div class="fb-form-group">
            <button type="button" id="fb-select-element" class="fb-button fb-button-outline">
              <span style="display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="1"></circle>
                  <path d="M12 12 4 20 M12 12l8 8"></path>
                </svg>
                Select Element
              </span>
            </button>
          </div>
          
          <div id="fb-selected-element-container" style="display: none;" class="fb-form-group">
            <div class="fb-selected-element">
              <strong>Selected Element:</strong>
              <div id="fb-element-path"></div>
            </div>
          </div>
          
          <div class="fb-form-group">
            <button type="submit" id="fb-submit" class="fb-button">Submit Feedback</button>
          </div>
        </form>
      `;
      
      card.appendChild(body);
      container.appendChild(card);
      
      // Create overlay for targeting mode
      const overlay = document.createElement('div');
      overlay.className = 'fb-overlay';
      overlay.id = 'fb-targeting-overlay';
      
      const targetingInfo = document.createElement('div');
      targetingInfo.className = 'fb-targeting-info';
      targetingInfo.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 12px;">Select an element</h4>
        <p style="margin-bottom: 16px;">Click on any element on the page to provide feedback for it. Press ESC to cancel.</p>
        <button id="fb-cancel-targeting" class="fb-button">Cancel</button>
      `;
      
      overlay.appendChild(targetingInfo);
      
      // Add everything to shadow DOM
      shadowRoot.appendChild(container);
      
      // The overlay needs to be in the document body to cover the whole page
      document.body.appendChild(overlay);
      
      // Append host to body
      document.body.appendChild(hostContainer);
      this.widget = container;
    }
    
    private initEventListeners() {
      if (!this.shadowRoot) return;
      
      // Get elements from shadow DOM
      const form = this.shadowRoot.getElementById('fb-feedback-form');
      const selectElementButton = this.shadowRoot.getElementById('fb-select-element');
      
      // Get cancel button from document body (outside shadow DOM)
      const cancelTargetingButton = document.getElementById('fb-cancel-targeting');
      
      // Form submission
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitFeedback();
        });
      }
      
      // Select element button
      if (selectElementButton) {
        selectElementButton.addEventListener('click', () => {
          this.startTargeting();
        });
      }
      
      // Cancel targeting button
      if (cancelTargetingButton) {
        cancelTargetingButton.addEventListener('click', () => {
          this.cancelTargeting();
        });
      }
      
      // Listen for ESC key to cancel targeting
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isTargeting) {
          this.cancelTargeting();
        }
      });
    }
    
    private toggleWidget(force?: boolean) {
      if (!this.shadowRoot) return;
      
      const card = this.widget?.querySelector('.fb-card') as HTMLElement;
      this.isOpen = force !== undefined ? force : !this.isOpen;
      
      if (card) {
        card.style.display = this.isOpen ? 'block' : 'none';
      }
    }
    
    private startTargeting() {
      this.isTargeting = true;
      this.toggleWidget(false);
      
      // The overlay is in the document body, not in the shadow DOM
      const overlay = document.getElementById('fb-targeting-overlay') as HTMLElement;
      if (overlay) {
        overlay.style.display = 'block';
      }
      
      document.body.style.cursor = 'crosshair';
      
      // Add mouseover event to highlight elements
      document.addEventListener('mouseover', this.handleMouseOver);
      
      // Add click event to select elements
      document.addEventListener('click', this.handleClick, true);
    }
    
    private cancelTargeting() {
      this.isTargeting = false;
      
      // The overlay is in the document body, not in the shadow DOM
      const overlay = document.getElementById('fb-targeting-overlay') as HTMLElement;
      if (overlay) {
        overlay.style.display = 'none';
      }
      
      document.body.style.cursor = '';
      
      // Remove event listeners
      document.removeEventListener('mouseover', this.handleMouseOver);
      document.removeEventListener('click', this.handleClick, true);
      
      // Remove any lingering highlights
      if (this.hoveredElement) {
        this.hoveredElement.style.outline = '';
        this.hoveredElement.style.outlineOffset = '';
        this.hoveredElement = null;
      }
    }
    
    private handleMouseOver = (e: MouseEvent) => {
      if (!this.isTargeting) return;
      
      const element = e.target as HTMLElement;
      
      // Prevent targeting the overlay or the widget itself
      if (element.closest('#fb-targeting-overlay') || element.closest('.fb-widget-container')) {
        return;
      }
      
      // Remove highlight from previous element
      if (this.hoveredElement && this.hoveredElement !== element) {
        this.hoveredElement.style.outline = '';
        this.hoveredElement.style.outlineOffset = '';
      }
      
      // Add highlight to current element
      element.style.outline = '2px solid #3b82f6';
      element.style.outlineOffset = '2px';
      this.hoveredElement = element;
    };
    
    private handleClick = (e: MouseEvent) => {
      if (!this.isTargeting || !this.shadowRoot) return;
      
      // Prevent targeting the overlay or the widget itself
      const element = e.target as HTMLElement;
      if (element.closest('#fb-targeting-overlay') || element.closest('.fb-widget-container') || element.closest('#feedback-widget-host')) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      this.selectedElement = element;
      this.elementPath = this.getCssPath(element);
      this.coordinates = {
        x: e.pageX,
        y: e.pageY
      };
      
      // Update UI - get elements from shadow DOM
      const pathElement = this.shadowRoot.getElementById('fb-element-path');
      const elementContainer = this.shadowRoot.getElementById('fb-selected-element-container');
      
      if (pathElement) {
        pathElement.textContent = this.elementPath;
      }
      
      if (elementContainer) {
        elementContainer.style.display = 'block';
      }
      
      // Exit targeting mode
      this.cancelTargeting();
      
      // Reopen the widget
      this.toggleWidget(true);
    };
    
    private getCssPath(element: HTMLElement): string {
      if (!element) return '';
      if (element === document.body) return 'body';
      
      const path: string[] = [];
      let currentElement: HTMLElement | null = element;
      
      while (currentElement && currentElement !== document.body) {
        let selector = currentElement.tagName.toLowerCase();
        
        // Add id if available
        if (currentElement.id) {
          selector += `#${currentElement.id}`;
          path.unshift(selector);
          break;
        }
        
        // Add classes if available
        if (currentElement.className) {
          const classes = currentElement.className.split(/\s+/).filter(c => c);
          if (classes.length) {
            selector += `.${classes.join('.')}`;
          }
        }
        
        // Add position among siblings if needed
        const siblings = Array.from(currentElement.parentElement?.children || []);
        if (siblings.length > 1) {
          const index = siblings.indexOf(currentElement) + 1;
          selector += `:nth-child(${index})`;
        }
        
        path.unshift(selector);
        currentElement = currentElement.parentElement;
      }
      
      return path.join(' > ');
    }
    
    private submitFeedback() {
      if (!this.shadowRoot) return;
      
      // Get form values from shadow DOM
      const titleInput = this.shadowRoot.getElementById('fb-title') as HTMLInputElement;
      const descriptionInput = this.shadowRoot.getElementById('fb-description') as HTMLTextAreaElement;
      const priorityInput = this.shadowRoot.getElementById('fb-priority') as HTMLSelectElement;
      
      const title = titleInput?.value;
      const description = descriptionInput?.value;
      const priority = priorityInput?.value;
      
      // Validate
      if (!title || !description) {
        alert('Please fill in all required fields');
        return;
      }
      
      // Prepare payload
      const payload = {
        projectId: this.projectId,
        pagePath: window.location.pathname,
        elementPath: this.elementPath,
        coordinates: this.coordinates,
        status: 'open',
        priority: priority || 'medium',
        title,
        description
      };
      
      // Submit data
      fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to submit feedback');
          }
          return response.json();
        })
        .then(() => {
          // Success
          alert('Feedback submitted successfully!');
          
          // Reset form
          titleInput.value = '';
          descriptionInput.value = '';
          
          // Clear selected element
          this.selectedElement = null;
          this.elementPath = null;
          this.coordinates = null;
          
          // Get element container from shadow DOM
          const elementContainer = this.shadowRoot?.getElementById('fb-selected-element-container');
          if (elementContainer) {
            elementContainer.style.display = 'none';
          }
          
          // Close widget
          this.toggleWidget(false);
        })
        .catch(error => {
          console.error('Error submitting feedback:', error);
          alert('Failed to submit feedback. Please try again.');
        });
    }
  }
  
  // Expose to global scope
  (window as any).FeedbackWidget = FeedbackWidget;
})();
# Animation & Motion Guidelines for Payymo

This document outlines the standards and best practices for implementing animations and motion in the Payymo financial platform. These guidelines ensure a balanced approach to animation that enhances user experience without compromising performance or accessibility.

## 1. Animation Principles

### Core Principles

1. **Purpose-Driven**: Every animation should serve a clear purpose (feedback, guidance, or delight)
2. **Subtle & Professional**: Animations should be subtle and align with the professional nature of a financial platform
3. **Consistent**: Animation styles should be consistent throughout the application
4. **Performant**: Animations should maintain 60fps and not impact application performance
5. **Accessible**: Respect user preferences for reduced motion

### Animation Purposes

| Purpose | Description | Examples |
|---------|-------------|----------|
| **Feedback** | Confirm user actions have been received | Button press, form submission, toggle state changes |
| **Orientation** | Guide users through interface changes | Page transitions, modal appearing/disappearing |
| **Attention** | Direct user attention to important elements | Highlighting new information, error messages |
| **Education** | Explain relationships or functionality | Progressive disclosure, hints about hidden features |

## 2. Animation Standards

### Timing & Easing

- **Ultra-Short** (50-150ms): Immediate feedback (button presses, toggles)
- **Short** (150-300ms): Simple transitions (hover states, showing/hiding elements)
- **Medium** (300-500ms): More complex transitions (page changes, modal dialogs)
- **Long** (500-1000ms): Reserved for complex, multi-stage animations (only when necessary)

| Animation Type | Duration | Easing |
|----------------|----------|--------|
| Button Feedback | 100ms | ease-out |
| Hover Effects | 200ms | ease-in-out |
| Modal Entry/Exit | 300ms | ease-in-out |
| Page Transitions | 400ms | ease-in-out |
| Data Visualization | 800ms | ease-out |

### Animation CSS Implementation

```css
/* Standard transition variables */
:root {
  --transition-ultra-short: 100ms;
  --transition-short: 200ms;
  --transition-medium: 300ms;
  --transition-long: 800ms;
  
  --easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
  --easing-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);
  --easing-accelerate: cubic-bezier(0.4, 0.0, 1, 1);
}

/* Standard animations */
.btn {
  transition: transform var(--transition-ultra-short) var(--easing-decelerate),
              background-color var(--transition-short) var(--easing-standard);
}

.btn:active {
  transform: scale(0.97);
}

/* Card hover effect */
.card {
  transition: transform var(--transition-short) var(--easing-standard),
              box-shadow var(--transition-short) var(--easing-standard);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

/* Modal dialog */
.modal-backdrop {
  transition: opacity var(--transition-medium) var(--easing-standard);
  opacity: 0;
}

.modal-backdrop.active {
  opacity: 1;
}

.modal-content {
  transition: opacity var(--transition-medium) var(--easing-standard),
              transform var(--transition-medium) var(--easing-standard);
  opacity: 0;
  transform: scale(0.95);
}

.modal-content.active {
  opacity: 1;
  transform: scale(1);
}
```

### Animation JavaScript Implementation

For more complex animations, use vanilla JavaScript with CSS transitions or the Web Animation API:

```javascript
// Modal animation with JavaScript
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  const backdrop = modal.querySelector('.modal-backdrop');
  const content = modal.querySelector('.modal-content');
  
  // Show the modal container
  modal.style.display = 'flex';
  
  // Trigger animations
  requestAnimationFrame(() => {
    backdrop.classList.add('active');
    
    // Delay content animation slightly
    setTimeout(() => {
      content.classList.add('active');
    }, 50);
  });
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  const backdrop = modal.querySelector('.modal-backdrop');
  const content = modal.querySelector('.modal-content');
  
  // Remove active classes to trigger animations
  content.classList.remove('active');
  backdrop.classList.remove('active');
  
  // Wait for animations to complete before hiding
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300); // Match the CSS transition duration
}

// Web Animation API example for more complex animations
function animateChartBar(element, initialValue, finalValue) {
  const animation = element.animate(
    [
      { height: initialValue + '%', opacity: 0 },
      { height: finalValue + '%', opacity: 1 }
    ],
    {
      duration: 800,
      easing: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
      fill: 'forwards'
    }
  );
  
  return animation.finished; // Returns a Promise
}
```

## 3. Specific UI Components

### Button States

- **Default to Hover**: Subtle background color change (200ms)
- **Hover to Active**: Scale down to 97% (100ms)
- **Loading State**: Spinning indicator replaces text (300ms transition)
- **Success/Error**: Briefly show icon with color change (800ms, then revert)

```css
/* Button state animations */
.btn {
  position: relative;
  transition: background-color 200ms var(--easing-standard),
              transform 100ms var(--easing-decelerate);
}

.btn:hover {
  background-color: var(--color-btn-hover);
}

.btn:active {
  transform: scale(0.97);
}

/* Loading state */
.btn.loading .btn-text {
  opacity: 0;
}

.btn.loading .spinner {
  opacity: 1;
}

.btn .btn-text, 
.btn .spinner {
  transition: opacity 300ms var(--easing-standard);
}

.btn .spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
}
```

### Form Elements

- **Input Focus**: Border highlight with subtle transition (200ms)
- **Validation Feedback**: Error and success states with icon and color transitions (200ms)
- **Dropdown**: Smooth expand/collapse animation (250ms)

```css
/* Form element animations */
.form-control {
  border: 1px solid var(--color-border);
  transition: border-color 200ms var(--easing-standard),
              box-shadow 200ms var(--easing-standard);
}

.form-control:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* Validation states */
.form-control.is-valid {
  border-color: var(--color-success);
  padding-right: 2.5rem; /* Space for icon */
  background-image: url("data:image/svg+xml,..."); /* Success icon */
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  transition: border-color 200ms var(--easing-standard),
              background-image 200ms var(--easing-standard);
}

.form-control.is-invalid {
  border-color: var(--color-danger);
  padding-right: 2.5rem; /* Space for icon */
  background-image: url("data:image/svg+xml,..."); /* Error icon */
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  transition: border-color 200ms var(--easing-standard),
              background-image 200ms var(--easing-standard);
}

/* Dropdown animations */
.dropdown-menu {
  transform-origin: top;
  transition: transform 250ms var(--easing-standard),
              opacity 250ms var(--easing-standard);
  transform: scaleY(0);
  opacity: 0;
}

.dropdown.show .dropdown-menu {
  transform: scaleY(1);
  opacity: 1;
}
```

### Modal Dialogs

- **Entry**: Fade in backdrop (250ms), scale content from 95% to 100% (300ms)
- **Exit**: Reverse of entry animation
- **Focus Management**: Focus first interactive element on open

```javascript
// Modal animation and focus management
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  const modalContent = modal.querySelector('.modal-content');
  const backdrop = modal.querySelector('.modal-backdrop');
  const focusableElements = modal.querySelectorAll(
    'a[href], button, textarea, input[type="text"], input[type="checkbox"], select'
  );
  
  // Store the element that had focus before opening the modal
  modal.previousFocus = document.activeElement;
  
  // Show modal
  modal.style.display = 'flex';
  
  // Animate in
  requestAnimationFrame(() => {
    backdrop.classList.add('active');
    
    setTimeout(() => {
      modalContent.classList.add('active');
      
      // Set focus to the first focusable element in the modal
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }, 50);
  });
  
  // Setup focus trapping
  modal.addEventListener('keydown', trapFocus);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  const modalContent = modal.querySelector('.modal-content');
  const backdrop = modal.querySelector('.modal-backdrop');
  
  // Animate out
  modalContent.classList.remove('active');
  backdrop.classList.remove('active');
  
  // Hide modal after animation completes
  setTimeout(() => {
    modal.style.display = 'none';
    
    // Restore focus to the element that had focus before opening the modal
    if (modal.previousFocus) {
      modal.previousFocus.focus();
    }
  }, 300);
  
  // Remove focus trapping
  modal.removeEventListener('keydown', trapFocus);
}

function trapFocus(event) {
  if (event.key !== 'Tab') return;
  
  const modal = event.currentTarget;
  const focusableElements = modal.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input:not([disabled]), select'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // If Shift+Tab on first element, move to last element
  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } 
  // If Tab on last element, move to first element
  else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}
```

### Page Transitions

- **Transition Between Pages**: Fade out/in and subtle slide (400ms total)
- **Data Loading States**: Skeleton screens instead of spinners where possible

```css
/* Page transition animations */
.page-container {
  opacity: 0;
  transform: translateY(10px);
  animation: page-enter 400ms var(--easing-standard) forwards;
}

@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Skeleton screen animation */
.skeleton-loader {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

### Data Visualizations

- **Chart Loading**: Progressive reveal of elements (800ms, staggered)
- **Chart Updates**: Smooth transitions between data states (800ms)
- **Hover Effects**: Quick highlight of data points (150ms)

```javascript
// Chart animation example
function animateBarChart(chartId, data) {
  const chart = document.getElementById(chartId);
  const bars = chart.querySelectorAll('.bar');
  
  // Reset all bars
  bars.forEach(bar => {
    bar.style.height = '0%';
    bar.style.opacity = '0';
  });
  
  // Animate each bar with staggered delay
  bars.forEach((bar, index) => {
    setTimeout(() => {
      const value = data[index].value;
      const maxValue = Math.max(...data.map(d => d.value));
      const percentage = (value / maxValue) * 100;
      
      animateChartBar(bar, 0, percentage);
    }, index * 100); // 100ms staggered delay
  });
}

function animateChartBar(element, initialValue, finalValue) {
  return element.animate(
    [
      { height: initialValue + '%', opacity: 0 },
      { height: finalValue + '%', opacity: 1 }
    ],
    {
      duration: 800,
      easing: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
      fill: 'forwards'
    }
  ).finished;
}
```

## 4. Accessibility Considerations

### Reduced Motion Preferences

Always respect the user's `prefers-reduced-motion` setting by providing alternative subtle animations or disabling animations entirely:

```css
/* Base animations */
.card {
  transition: transform 200ms var(--easing-standard),
              box-shadow 200ms var(--easing-standard);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

/* Reduced motion override */
@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }
  
  .card:hover {
    transform: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
}
```

For JavaScript-based animations:

```javascript
// Check for reduced motion preference
function shouldReduceMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animateWithReducedMotionSupport(element, animationFunction) {
  if (shouldReduceMotion()) {
    // Apply a simpler animation or skip animation entirely
    element.style.opacity = '1'; // Just show the element immediately
    return Promise.resolve(); // Return resolved promise
  } else {
    // Apply full animation
    return animationFunction(element);
  }
}

// Example usage
animateWithReducedMotionSupport(chartBar, (element) => {
  return animateChartBar(element, 0, percentage);
});
```

### Critical Requirements

1. **No Flashing**: Ensure animations do not flash more than three times per second
2. **Alternative Content**: Provide non-animated alternatives for critical information
3. **Keyboard Support**: Ensure animations do not interfere with keyboard navigation
4. **Focus Management**: Maintain proper focus during animated transitions

## 5. Performance Optimization

### Efficient Animation Properties

Prioritize animating properties that the browser can optimize:

| Preferred Properties | Avoid When Possible |
|---------------------|---------------------|
| `transform` | `width`/`height` |
| `opacity` | `top`/`left`/`right`/`bottom` |
| `filter` | `margin`/`padding` |
| `color` | `font-size` |
| `background-color` | `float`/`position` |

### Performance Testing

- Test animations on low-end devices to ensure smooth performance
- Use browser developer tools to monitor frame rates
- Aim for consistent 60fps performance
- Simplify animations that cause jank

```javascript
// Performance monitoring example
function monitorAnimationPerformance(animationCallback) {
  let lastTime = performance.now();
  let frames = 0;
  
  // Setup monitoring
  const monitor = () => {
    const time = performance.now();
    frames++;
    
    if (time - lastTime >= 1000) { // Every second
      const fps = Math.round((frames * 1000) / (time - lastTime));
      console.log(`Animation performance: ${fps} FPS`);
      
      // Log warning for poor performance
      if (fps < 50) {
        console.warn('Animation performance below target (60 FPS)');
      }
      
      frames = 0;
      lastTime = time;
    }
    
    requestAnimationFrame(monitor);
  };
  
  // Start monitoring
  requestAnimationFrame(monitor);
  
  // Run the animation
  animationCallback();
}
```

## 6. Implementation Examples

### Transaction List Animation

For a key component like a transaction list:

```javascript
// Animate transaction list with staggered entries
function animateTransactionList(transactions) {
  const transactionList = document.querySelector('.transaction-list');
  transactionList.innerHTML = ''; // Clear current list
  
  const fragment = document.createDocumentFragment();
  
  // Create all transaction items first (performance optimization)
  transactions.forEach(transaction => {
    const item = document.createElement('li');
    item.className = 'transaction-item';
    item.style.opacity = '0';
    item.style.transform = 'translateY(10px)';
    
    // Populate item content
    item.innerHTML = `
      <div class="transaction-date">${transaction.date}</div>
      <div class="transaction-description">${transaction.description}</div>
      <div class="transaction-amount ${transaction.amount < 0 ? 'negative' : 'positive'}">
        ${transaction.amount < 0 ? '-' : '+'}$${Math.abs(transaction.amount).toFixed(2)}
      </div>
    `;
    
    fragment.appendChild(item);
  });
  
  // Add all items to DOM at once
  transactionList.appendChild(fragment);
  
  // Now animate them with staggered delay
  const items = transactionList.querySelectorAll('.transaction-item');
  
  // Check for reduced motion preference
  if (shouldReduceMotion()) {
    // Simple fade in without motion
    items.forEach(item => {
      item.style.transform = 'none';
      item.style.opacity = '1';
    });
  } else {
    // Full animation with staggered delay
    items.forEach((item, index) => {
      setTimeout(() => {
        item.style.transition = 'opacity 300ms ease-out, transform 300ms ease-out';
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      }, 50 * index); // 50ms staggered delay between items
    });
  }
}
```

### Bank Connection Flow

For the bank connection process:

```javascript
// Multi-step bank connection flow with smooth transitions
function initBankConnectionFlow() {
  const steps = document.querySelectorAll('.connection-step');
  let currentStep = 0;
  
  function showStep(index) {
    // Hide all steps
    steps.forEach(step => {
      step.style.display = 'none';
      step.style.opacity = '0';
      step.style.transform = 'translateX(20px)';
    });
    
    // Show current step
    steps[index].style.display = 'block';
    
    // Trigger animation
    setTimeout(() => {
      steps[index].style.transition = 'opacity 300ms ease-out, transform 300ms ease-out';
      steps[index].style.opacity = '1';
      steps[index].style.transform = 'translateX(0)';
    }, 50);
    
    // Update progress indicator
    updateProgress(index);
  }
  
  function updateProgress(step) {
    const progress = document.querySelector('.connection-progress-bar');
    const percentage = (step / (steps.length - 1)) * 100;
    
    progress.style.transition = 'width 400ms ease-in-out';
    progress.style.width = `${percentage}%`;
  }
  
  // Initialize first step
  showStep(currentStep);
  
  // Next button handler
  document.querySelectorAll('.btn-next').forEach(button => {
    button.addEventListener('click', () => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        showStep(currentStep);
      }
    });
  });
  
  // Back button handler
  document.querySelectorAll('.btn-back').forEach(button => {
    button.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
      }
    });
  });
}
```

## 7. Implementation Checklist

- [ ] Create CSS variables for standard animation durations and easings
- [ ] Implement reduced motion media query alternatives for all animations
- [ ] Test animation performance on lower-end devices
- [ ] Ensure focus management in modals and other interactive components
- [ ] Create consistent button state animations
- [ ] Implement smooth form validation feedback animations
- [ ] Develop page transition animations
- [ ] Create staggered animations for lists and data displays
- [ ] Implement loading state animations (skeletons, progress indicators)
- [ ] Test all animations for accessibility compliance
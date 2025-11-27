import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.scss'],
  standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  private observer: MutationObserver | null = null;

  ngOnInit(): void {
    // Disable Grammarly-like extension edits by applying well-known attributes.
    const setDisabled = (el: HTMLElement) => {
      try {
        el.setAttribute('data-gramm', 'false');
        el.setAttribute('data-gramm_editor', 'false');
        el.setAttribute('data-enable-grammarly', 'false');
        el.setAttribute('data-gramm-check', 'false');
      } catch {
        // ignore non-HTMLElements
      }
    };

    // Apply to current inputs and textareas
    if (typeof document !== 'undefined') {
      const elements = Array.from(document.querySelectorAll('textarea, input, [contenteditable="true"]')) as HTMLElement[];
      elements.forEach(setDisabled);

      // Observe newly added nodes and disable Grammarly attributes automatically
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          m.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (node.matches('textarea, input, [contenteditable="true"]')) setDisabled(node);
              const nested = Array.from(node.querySelectorAll('textarea, input, [contenteditable="true"]')) as HTMLElement[];
              nested.forEach(setDisabled);
            }
          });
        });
      });
      this.observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
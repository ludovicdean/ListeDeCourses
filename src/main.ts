import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

registerLocaleData(localeFr);

/**
 * Chrome DevTools embeds web-vitals with a `reportAllChanges` hook that crashes
 * on soft navigations when Angular writes linked `console.timeStamp` entries.
 * @see https://github.com/GoogleChrome/web-vitals/issues/792
 */
function patchConsoleTimeStampForChromeDevTools(): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) {
    return;
  }

  const timeStamp = console.timeStamp?.bind(console);
  if (!timeStamp) {
    return;
  }

  console.timeStamp = ((label?: string, ...rest: unknown[]) => {
    if (rest.length > 0) {
      return;
    }
    timeStamp(label);
  }) as typeof console.timeStamp;
}

patchConsoleTimeStampForChromeDevTools();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

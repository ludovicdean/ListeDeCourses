import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map, type Observable } from 'rxjs';

import { parsePositiveIntParam } from './parse-route-param';

export function routeParamNumber$(paramName: string): Observable<number> {
  const route = inject(ActivatedRoute);
  return route.paramMap.pipe(
    map((params) => parsePositiveIntParam(params.get(paramName)) ?? 0),
  );
}

export function routeParamNumberSignal(paramName: string, initialValue = 0) {
  return toSignal(routeParamNumber$(paramName), { initialValue });
}

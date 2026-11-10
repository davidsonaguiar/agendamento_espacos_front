import { register } from 'tsx/esm/api'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import React from 'react'

// O loader de testes pode usar o runtime JSX clássico. O build usa react-jsx.
globalThis.React = React

register({ tsconfig: './tsconfig.app.json' })
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true }
    if (url.endsWith('/services/http.ts')) {
      return { ...nextLoad(url, context), source: readFileSync(new URL(url), 'utf8').replace('import.meta.env.VITE_API_URL', "'http://localhost:8000'"), format: 'module-typescript' }
    }
    return nextLoad(url, context)
  },
})
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173' })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Node', 'Event', 'MouseEvent', 'sessionStorage']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

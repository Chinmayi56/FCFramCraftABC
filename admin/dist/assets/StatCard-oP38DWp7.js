import{d as s,j as e,L as m}from"./index-BlzptcgY.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=s("ArrowDownRight",[["path",{d:"m7 7 10 10",key:"1fmybs"}],["path",{d:"M17 7v10H7",key:"6fjiku"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=s("ArrowUpRight",[["path",{d:"M7 7h10v10",key:"1tivn9"}],["path",{d:"M7 17 17 7",key:"1vkiza"}]]),p={green:"bg-farm-green-50 text-farm-green-700",charcoal:"bg-farm-mist text-farm-charcoal-deep",amber:"bg-amber-50 text-amber-700",red:"bg-red-50 text-red-600"};function f({label:a,value:o,icon:i,trend:r,accent:n="green",to:t}){const c=t?m:"div",d=t?{to:t}:{};return e.jsxs(c,{...d,className:`block rounded-xl2 border border-black/5 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover sm:p-5 ${t?"cursor-pointer hover:border-farm-green-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-farm-green-200":""}`,children:[e.jsxs("div",{className:"flex items-start justify-between",children:[e.jsx("div",{className:`rounded-xl p-2.5 ${p[n]}`,children:e.jsx(i,{size:20,strokeWidth:2})}),r&&e.jsxs("span",{className:`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${r.direction==="up"?"bg-farm-green-50 text-farm-green-700":"bg-red-50 text-red-600"}`,children:[r.direction==="up"?e.jsx(x,{size:12}):e.jsx(l,{size:12}),r.value]})]}),e.jsx("p",{className:"mt-4 font-display text-2xl font-bold text-farm-charcoal-deep sm:text-3xl",children:o}),e.jsx("p",{className:"mt-1 text-sm text-farm-charcoal/60",children:a})]})}export{f as S};

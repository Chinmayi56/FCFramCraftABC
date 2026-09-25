import{d as c,r as n,j as e}from"./index-DOfCrsg9.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o=c("CircleCheck",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=c("CircleX",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]]);function l({message:a,variant:i="success",onClose:t,duration:s=2600}){n.useEffect(()=>{const m=setTimeout(t,s);return()=>clearTimeout(m)},[t,s]);const r=i==="success";return e.jsx("div",{className:"pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 sm:justify-end sm:px-6",children:e.jsxs("div",{className:`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-card-hover animate-fade-in ${r?"border-farm-green-200 bg-white text-farm-charcoal-deep":"border-red-200 bg-white text-farm-charcoal-deep"}`,children:[r?e.jsx(o,{size:17,className:"text-farm-green-600"}):e.jsx(d,{size:17,className:"text-red-600"}),a]})})}export{o as C,l as T};

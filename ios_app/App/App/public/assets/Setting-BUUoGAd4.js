import{r as e}from"./rolldown-runtime-hePW80VL.js";import{d as t}from"./vendor-charts-C9qgelbo.js";import{s as n,t as r}from"./vendor-react-CIa2Ztvt.js";import{a as i,o as a,s as o}from"./index-84A0evYC.js";var s=e(t(),1),c=r(),l=s.memo(()=>{let{theme:e,toggleTheme:t}=o(),{user:r,logout:l,refreshUser:u,unsubscribeUser:d}=i(),{showSuccess:f,showError:p}=a(),m=n(),h=e===`white`,g=r&&r.role!==`guest`,_=r?.subscribe===!0,[v,y]=(0,s.useState)(!1),[b,x]=(0,s.useState)(!1),S=()=>m(`/login`),C=()=>m(`/manageaccount`),w=async()=>{if(!v&&window.confirm(`Are you sure you want to cancel your subscription?`)){y(!0);try{let e=await d();e.success?f(`Subscription downgraded to Free Tier.`):p(e.error||`Failed to cancel subscription.`)}catch(e){p(e.message||`Failed to cancel subscription.`)}finally{y(!1)}}},T=async()=>{if(!b&&window.confirm(`Are you sure you want to sign out?`)){x(!0);try{await l(),f(`Signed out successfully.`),m(`/login`)}catch(e){p(e.message||`Logout failed`)}finally{x(!1)}}};(0,s.useEffect)(()=>{(async()=>{g&&await u()})()},[g,u]);let E=(e,t)=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),t())},D=h?`bg-gray-50`:`bg-zinc-950`,O=h?`text-gray-800`:`text-zinc-300`,k=h?`bg-white`:`bg-zinc-900`,A=h?`border-gray-200`:`border-zinc-800`,j=h?`text-gray-500`:`text-zinc-400`,M=h?`bg-white`:`bg-zinc-900`,N=h?`hover:bg-gray-50`:`hover:bg-zinc-800/80`,P=h?`shadow-sm`:`shadow-sm shadow-black/10`,F=h?`bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm`:`bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 shadow-sm`,I=h?`group-hover:border-blue-400`:`group-hover:border-blue-500/30`;return(0,c.jsxs)(`div`,{className:`min-h-screen w-full flex flex-col font-sans transition-colors duration-200 ${D} ${O}`,children:[(0,c.jsxs)(`header`,{className:`h-12 flex items-center px-6 border-b shrink-0 ${k} ${A}`,children:[(0,c.jsxs)(`button`,{type:`button`,onClick:()=>m(`/home`),className:`
            flex items-center gap-2 text-xs font-medium transition-all duration-200
            ${h?`text-gray-500 hover:text-gray-900`:`text-zinc-400 hover:text-white`}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1
            ${h?`focus:ring-offset-white`:`focus:ring-offset-zinc-900`}
          `,"aria-label":`Go back to Home`,children:[(0,c.jsx)(`svg`,{className:`w-4 h-4`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,viewBox:`0 0 24 24`,children:(0,c.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,d:`M10 19l-7-7m0 0l7-7m-7 7h18`})}),(0,c.jsx)(`span`,{children:`Back`})]}),(0,c.jsx)(`h1`,{className:`flex-1 text-center text-xs font-bold tracking-wider select-none`,children:`Settings`}),(0,c.jsx)(`div`,{className:`w-20`})]}),(0,c.jsxs)(`main`,{className:`flex-1 p-6 max-w-lg mx-auto w-full space-y-4`,children:[(0,c.jsxs)(`div`,{className:`
            p-4 rounded-xl border transition-all duration-200
            ${M} ${A} ${P} ${N}
            flex items-center justify-between gap-4
          `,children:[(0,c.jsxs)(`div`,{className:`space-y-0.5 select-none min-w-0 flex-1`,children:[(0,c.jsx)(`h3`,{className:`text-xs font-semibold tracking-wide`,children:`Workspace Theme`}),(0,c.jsx)(`p`,{className:`text-[11px] leading-relaxed ${j}`,children:`Switch between light and dark interface configurations.`})]}),(0,c.jsx)(`button`,{type:`button`,onClick:t,className:`
              px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${h?`focus:ring-offset-white`:`focus:ring-offset-zinc-900`}
              ${F}
              whitespace-nowrap shrink-0
            `,children:h?`🌙 Dark Mode`:`☀️ Light Mode`})]}),(0,c.jsxs)(`div`,{role:`button`,tabIndex:0,onClick:C,onKeyDown:e=>E(e,C),className:`
            p-4 rounded-xl border transition-all duration-200 cursor-pointer group
            ${M} ${A} ${P} ${N}
            flex items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-blue-500
          `,children:[(0,c.jsxs)(`div`,{className:`space-y-0.5 select-none min-w-0 flex-1`,children:[(0,c.jsx)(`h3`,{className:`text-xs font-semibold tracking-wide`,children:`Account Identity`}),(0,c.jsx)(`p`,{className:`text-[11px] leading-relaxed ${j}`,children:`Manage your account settings, permissions, and active sessions.`})]}),(0,c.jsx)(`div`,{className:`
              px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
              ${F} ${I}
              whitespace-nowrap shrink-0
            `,children:`Manage`})]}),(0,c.jsxs)(`div`,{role:`button`,tabIndex:0,onClick:()=>m(`/dashboard`),onKeyDown:e=>E(e,()=>m(`/dashboard`)),className:`
            p-4 rounded-xl border transition-all duration-200 cursor-pointer group
            ${M} ${A} ${P} ${N}
            flex items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-blue-500
          `,children:[(0,c.jsxs)(`div`,{className:`space-y-0.5 select-none min-w-0 flex-1`,children:[(0,c.jsx)(`h3`,{className:`text-xs font-semibold tracking-wide`,children:`📊 Dashboard`}),(0,c.jsx)(`p`,{className:`text-[11px] leading-relaxed ${j}`,children:`Visualise real‑time API performance, latency trends, and request analytics.`})]}),(0,c.jsx)(`div`,{className:`
              px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
              ${F} ${I}
              whitespace-nowrap shrink-0
            `,children:`Open`})]}),(0,c.jsxs)(`div`,{role:`button`,tabIndex:0,onClick:()=>m(`/tools`),onKeyDown:e=>E(e,()=>m(`/tools`)),className:`
            p-4 rounded-xl border transition-all duration-200 cursor-pointer group
            ${M} ${A} ${P} ${N}
            flex items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-blue-500
          `,children:[(0,c.jsxs)(`div`,{className:`space-y-0.5 select-none min-w-0 flex-1`,children:[(0,c.jsx)(`h3`,{className:`text-xs font-semibold tracking-wide`,children:`🛠️ Tools`}),(0,c.jsx)(`p`,{className:`text-[11px] leading-relaxed ${j}`,children:`Access import utilities, network diagnostics, and the advanced API builder.`})]}),(0,c.jsx)(`div`,{className:`
              px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
              ${F} ${I}
              whitespace-nowrap shrink-0
            `,children:`Launch`})]}),(0,c.jsxs)(`div`,{role:`button`,tabIndex:0,onClick:()=>m(`/change-password`),onKeyDown:e=>E(e,()=>m(`/change-password`)),className:`
            p-4 rounded-xl border transition-all duration-200 cursor-pointer group
            ${M} ${A} ${P} ${N}
            flex items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-blue-500
          `,children:[(0,c.jsxs)(`div`,{className:`space-y-0.5 select-none min-w-0 flex-1`,children:[(0,c.jsx)(`h3`,{className:`text-xs font-semibold tracking-wide`,children:`🔑 Change Password`}),(0,c.jsx)(`p`,{className:`text-[11px] leading-relaxed ${j}`,children:`Update your password by verifying your current credentials.`})]}),(0,c.jsx)(`div`,{className:`
              px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
              ${F} ${I}
              whitespace-nowrap shrink-0
            `,children:`Update`})]}),(0,c.jsxs)(`div`,{className:`
            p-4 rounded-xl border transition-all duration-200
            ${M} ${A} ${P} ${N}
            flex items-center justify-between gap-4
          `,children:[(0,c.jsxs)(`div`,{className:`space-y-0.5 select-none min-w-0 flex-1`,children:[(0,c.jsx)(`h3`,{className:`text-xs font-semibold tracking-wide`,children:g?_?`Subscription Active`:`Premium Access`:`Session Status`}),(0,c.jsx)(`p`,{className:`text-[11px] leading-relaxed ${j}`,children:g?_?`Welcome back, @${r?.username||`user`}! Pro features are enabled.`:`Signed in as @${r?.username||`user`}. Subscribe for unlimited access.`:`You are browsing as a guest. Sign in to unlock full features.`})]}),(0,c.jsx)(`div`,{className:`shrink-0 flex items-center`,children:g?(0,c.jsxs)(c.Fragment,{children:[!_&&(0,c.jsx)(`button`,{type:`button`,onClick:()=>m(`/subscribe`),disabled:v,className:`
                      px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
                      bg-rose-600 hover:bg-rose-500 text-white
                      focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2
                      ${h?`focus:ring-offset-white`:`focus:ring-offset-zinc-900`}
                      whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed
                    `,children:`Subscribe`}),_&&(0,c.jsx)(`button`,{type:`button`,onClick:w,disabled:v,className:`
                      px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
                      ${F}
                      focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2
                      ${h?`focus:ring-offset-white`:`focus:ring-offset-zinc-900`}
                      whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed
                    `,children:v?`Processing...`:`Cancel`})]}):(0,c.jsx)(`button`,{type:`button`,onClick:S,className:`
                  px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
                  bg-blue-600 hover:bg-blue-500 text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  ${h?`focus:ring-offset-white`:`focus:ring-offset-zinc-900`}
                  whitespace-nowrap
                `,children:`Sign In`})})]}),g&&(0,c.jsxs)(`div`,{role:`button`,tabIndex:0,onClick:T,onKeyDown:e=>E(e,T),className:`
              p-4 rounded-xl border transition-all duration-200 cursor-pointer group
              ${M} ${A} ${P} hover:border-rose-500/40 hover:bg-rose-500/5
              flex items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-rose-500
            `,children:[(0,c.jsxs)(`div`,{className:`space-y-0.5 select-none min-w-0 flex-1`,children:[(0,c.jsx)(`h3`,{className:`text-xs font-semibold tracking-wide text-rose-500`,children:`🚪 Sign Out`}),(0,c.jsx)(`p`,{className:`text-[11px] leading-relaxed ${j}`,children:`Terminate active session and return to authentication portal.`})]}),(0,c.jsx)(`button`,{type:`button`,disabled:b,className:`
                px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
                bg-rose-600/15 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30
                whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed
              `,children:b?`Signing out...`:`Sign Out`})]})]})]})});export{l as default};
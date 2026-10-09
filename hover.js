(function (root,factory) {
  'use strict';
  const motion = factory();
  if (typeof module === 'object' && module.exports) module.exports = motion;
  else motion.init(root);
})(globalThis,function () {
  'use strict';
  // Duration/bounce spring resolution follows Motion's published algorithm.
  function springFrames(duration = 400,bounce = .2) {
    const zeta = Math.max(.05,Math.min(1,1-bounce)), seconds = Math.max(1,duration) / 1000, s = Math.sqrt(1-zeta*zeta);
    let omega = 5/seconds;
    for (let i=1;i<12;i++) {
      if(s === 0) {
        const exp=Math.exp(-omega*seconds);
        omega-=(exp*(omega*seconds+1)-.001)/(-omega*seconds*seconds*exp);
        continue;
      }
      const exponential=Math.exp(-omega*zeta*seconds);
      const f=.001-zeta/s*exponential;
      const derivative=zeta*zeta*seconds/s*exponential;
      omega-=f/derivative;
    }
    return Array.from({length:61},(_,index) => {
      const t=index/60*seconds;
      const value=index === 60 ? 1 : s === 0 ? 1-Math.exp(-omega*t)*(1+omega*t) : 1-Math.exp(-zeta*omega*t)*(Math.cos(omega*s*t)+zeta/s*Math.sin(omega*s*t));
      return {offset:index/60,value};
    });
  }
  function init(win) {
    const doc=win.document, reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
    // Keep keyboard and form behavior independent of animation support.
    const dock=doc.querySelector('.contact-dock');
    if(dock) {
      const sync=()=>{dock.hidden=!!doc.activeElement?.matches('input,textarea,select');};
      doc.addEventListener('focusin',sync);doc.addEventListener('focusout',()=>win.setTimeout(sync,0));
    }
    if (!win.Element?.prototype.animate || !win.IntersectionObserver) return;
    const animations=new Map(), observers=new Set();
    const stop=element => { const old=animations.get(element);if(old){old.cancel();animations.delete(element);} };
    function play(element,frames,options) {
      stop(element);
      let animation;
      try { animation=element.animate(frames,{fill:'both',...options}); }
      catch { element.style.opacity='';return; }
      animations.set(element,animation);
      animation.onfinish=()=>{if(animations.get(element)!==animation)return;animations.delete(element);element.style.opacity='';animation.cancel();};
    }
    function inView(element,frames,options,threshold=.5) {
      if(reduced.matches)return;
      element.style.opacity='0.001';
      const ratio=Math.min(threshold,.5*Math.min(1,win.innerHeight/Math.max(1,element.getBoundingClientRect().height)));
      try {
        const observer=new win.IntersectionObserver(entries=>{
          if(entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=ratio)){observer.disconnect();observers.delete(observer);play(element,frames,options);}
        },{threshold:ratio});
        observers.add(observer);observer.observe(element);
      } catch { element.style.opacity=''; }
    }
    const curve=springFrames(400,.2);
    doc.querySelectorAll('.social-icon,.dock-action,.tool-tile,.booking-button').forEach(element=>{
      let hovered=false,focused=false,pressed=false;
      const booking=element.classList.contains('booking-button');
      const update=()=>{
        const from=win.getComputedStyle(element).transform;
        stop(element);
        element.style.opacity='';
        if(reduced.matches){element.style.transform='';return;}
        const active=hovered||focused;
        // Interpolate from the current pose on a rapid enter/leave.
        let startY=0,startScale=1;
        try {const matrix=new win.DOMMatrixReadOnly(from);startY=matrix.m42;startScale=matrix.a;}catch{}
        const endY=pressed?1:active?(booking?-4:-3):0,endScale=pressed?.975:active?(booking?1.035:1.04):1;
        const target=`translateY(${endY}px) scale(${endScale})`;
        const duration=pressed?180:booking?620:400;
        const response=booking?springFrames(duration,pressed?.12:.38):curve;
        const frames=response.map(({offset,value})=>({offset,transform:`translateY(${startY+(endY-startY)*value}px) scale(${startScale+(endScale-startScale)*value})`}));
        try{
          const a=element.animate(frames,{duration,fill:'both',easing:'linear'});animations.set(element,a);
          a.onfinish=()=>{if(animations.get(element)!==a)return;element.style.transform=target;animations.delete(element);a.cancel();};
        }catch{element.style.transform=target;}
      };
      element.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovered=true;update();}});
      element.addEventListener('pointerleave',()=>{hovered=false;pressed=false;update();});
      element.addEventListener('focus',()=>{focused=true;update();});
      element.addEventListener('blur',()=>{focused=false;update();});
      if(booking) {
        element.addEventListener('pointerdown',()=>{pressed=true;update();});
        ['pointerup','pointercancel'].forEach(event=>element.addEventListener(event,()=>{pressed=false;update();}));
      }
    });
    // Exact reference tech-stack entrances: x -5,-10,...; 600ms; 100ms stagger.
    doc.querySelectorAll('.tool-tile').forEach((element,index)=>inView(element,[{opacity:0,transform:`translateX(${-5*(index+1)}px)`},{opacity:1,transform:'translateX(0)'}],{duration:600,delay:index*100,easing:'cubic-bezier(.4,0,.2,1)'}));
    doc.querySelectorAll('.portrait-socials .social-icon').forEach((element,index)=>inView(element,[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],{duration:600,delay:index*100,easing:'cubic-bezier(.4,0,.2,1)'}));
    doc.querySelectorAll('.testimonial-card,.call-preview,.request-form,.feedback-invite').forEach((element,index)=>inView(element,[{opacity:.001,filter:'blur(5px)',transform:'translateY(10px)'},{opacity:1,filter:'blur(0)',transform:'translateY(0)'}],{duration:800,delay:Math.min(index%3,2)*100,easing:'cubic-bezier(.4,0,.2,1)'},.15));
    doc.querySelectorAll('.page-heading h1').forEach(heading=>{
      if(reduced.matches)return;
      const walker=doc.createTreeWalker(heading,win.NodeFilter.SHOW_TEXT),nodes=[];let node;
      while((node=walker.nextNode()))nodes.push(node);
      const words=[];
      nodes.forEach(text=>{
        const fragment=doc.createDocumentFragment();
        text.textContent.split(/(\s+)/).forEach(token=>{
          if(!token)return;
          if(/^\s+$/.test(token))fragment.appendChild(doc.createTextNode(token));
          else{const word=doc.createElement('span');word.className='motion-word';word.textContent=token;fragment.appendChild(word);words.push(word);}
        });text.replaceWith(fragment);
      });
      words.forEach((word,index)=>play(word,[{opacity:.001,filter:'blur(5px)',transform:'translateY(10px)'},{opacity:1,filter:'blur(0)',transform:'translateY(0)'}],{duration:800,delay:200+index*50,easing:'cubic-bezier(.4,0,.2,1)'}));
    });
    const reset=()=>{
      if(!reduced.matches)return;
      observers.forEach(observer=>observer.disconnect());observers.clear();
      animations.forEach(animation=>animation.cancel());animations.clear();
      doc.querySelectorAll('.hover-target,.booking-button,.testimonial-card,.call-preview,.request-form,.feedback-invite,.motion-word').forEach(element=>{element.style.opacity='';element.style.transform='';});
    };
    if(reduced.addEventListener)reduced.addEventListener('change',reset);else reduced.addListener(reset);
    doc.addEventListener('visibilitychange',()=>{if(doc.hidden){animations.forEach(animation=>animation.finish());}});
  }
  return {springFrames,init};
});

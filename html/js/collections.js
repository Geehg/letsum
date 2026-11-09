(()=>{
 const links=[...document.querySelectorAll('[data-collection]')];
 function render(){const symbols=new URL(location.href).searchParams.get('view')==='symbols';document.getElementById('collection-fonts').hidden=symbols;document.getElementById('collection-symbols').hidden=!symbols;links.forEach(a=>{if((a.dataset.collection==='symbols')===symbols)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});window.dispatchEvent(new Event('resize'));}
 links.forEach(a=>a.addEventListener('click',e=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();history.pushState(null,'',a.href);render();}));window.addEventListener('popstate',render);render();
})();

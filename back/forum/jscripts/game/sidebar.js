/**
 * SIDEBAR NAVIGATION - HUNTER X HUNTER RPG
 * 
 * Regla F-JS-02: Vanilla ES6+. Sin jQuery en código nuevo.
 * Regla F-JS-01: Un archivo JS por feature.
 */

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('rpg-sidebar');
    const toggleBtn = document.getElementById('rpg-sidebar-toggle');
    
    if (!sidebar || !toggleBtn) {
        return;
    }
    
    // Recuperar estado previo de localStorage
    const isCollapsed = localStorage.getItem('rpg_sidebar_collapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    }
    
    toggleBtn.addEventListener('click', () => {
        const collapsed = sidebar.classList.toggle('collapsed');
        localStorage.setItem('rpg_sidebar_collapsed', collapsed ? 'true' : 'false');
    });
});

/* 
   RPG Custom Interactive Functions
   Theme Switcher, dynamic icons, and more.
*/

document.addEventListener("DOMContentLoaded", function() {
    function getCleanBase() {
        var el = document.getElementById('pj-nav-submenu');
        var val = el ? (el.getAttribute('data-base') || '') : '';
        val = val.replace(/^https?:/, '');
        if (!val && typeof rootpath !== 'undefined') {
            val = rootpath.replace(/^https?:/, '');
        }
        return val;
    }

    // --- 2. ROTATING HERO BANNER BACKGROUND ---
    const heroImages = [
        'https://images.unsplash.com/photo-1519074069444-1ba4e5663476?q=80&w=1920&auto=format&fit=crop', 
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop', 
        'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1920&auto=format&fit=crop', 
        'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1920&auto=format&fit=crop', 
        'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1920&auto=format&fit=crop'
    ];
    const randomHeroImg = heroImages[Math.floor(Math.random() * heroImages.length)];
    const heroSection = document.querySelector('.roleplay-hero');
    if (heroSection) {
        heroSection.style.backgroundImage = `url('${randomHeroImg}')`;
    }

    // Scroll-to-top button
    var scrollBtn = document.querySelector('.scroll-top');
    if (scrollBtn) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 400) scrollBtn.classList.add('is-visible');
            else scrollBtn.classList.remove('is-visible');
        });
        scrollBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- 3. DYNAMIC FORUM CARD STYLE & ICON MAP ---
    const themeConfig = {
        'reglamento':     { icon: 'fa-bullhorn',       color: '#8b5cf6', shadow: 'rgba(139, 92, 246, 0.4)' },
        'anuncios':       { icon: 'fa-bell',           color: '#C62828', shadow: 'rgba(198, 40, 40, 0.4)' },
        'noticias':       { icon: 'fa-file-alt',       color: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.4)' },
        'eventos':        { icon: 'fa-calendar-alt',   color: '#14b8a6', shadow: 'rgba(20, 184, 166, 0.4)' },
        'presentaciones': { icon: 'fa-user-astronaut', color: '#10b981', shadow: 'rgba(16, 185, 129, 0.4)' },
        'zona de usuarios':{ icon: 'fa-users',          color: '#06b6d4', shadow: 'rgba(6, 182, 212, 0.4)' },
        'cumpleaños':     { icon: 'fa-gift',           color: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.4)' },
        'despedidas':     { icon: 'fa-hand-paper',     color: '#f97316', shadow: 'rgba(249, 115, 22, 0.4)' },
        'guías de rol':   { icon: 'fa-book-open',      color: '#ec4899', shadow: 'rgba(236, 72, 153, 0.4)' },
        'búsqueda de rol': { icon: 'fa-search',         color: '#f43f5e', shadow: 'rgba(244, 63, 94, 0.4)' },
        'ambientación':   { icon: 'fa-globe-americas', color: '#f97316', shadow: 'rgba(249, 115, 22, 0.4)' },
        'off-topic':      { icon: 'fa-smile',          color: '#8b5cf6', shadow: 'rgba(139, 92, 246, 0.4)' },
        'default':        { icon: 'fa-compass',        color: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.3)' }
    };

    const forumCards = document.querySelectorAll('.rpg-forum-card');
    forumCards.forEach(card => {
        const titleLink = card.querySelector('.rpg-forum-name a');
        if (!titleLink) return;
        const titleText = titleLink.textContent.trim().toLowerCase();
        let selectedStyle = themeConfig['default'];
        
        for (const keyword in themeConfig) {
            if (titleText.includes(keyword)) {
                selectedStyle = themeConfig[keyword];
                break;
            }
        }
        
        const iconDiv = card.querySelector('.rpg-forum-icon');
        if (iconDiv) {
            iconDiv.innerHTML = `<i class="fas ${selectedStyle.icon}"></i>`;
            iconDiv.style.borderColor = selectedStyle.color;
            // The background color handles the opacity in CSS natively, but we can override it slightly
            iconDiv.style.color = selectedStyle.color; // Mantiene el icono colorido
            iconDiv.style.boxShadow = `0 0 15px ${selectedStyle.shadow}`;
        }
    });

    // --- 4. ANTI-FLICKER / FADE IN (Opcional) ---
    document.body.style.opacity = '1';

    // --- 5. CHARACTER SWITCHER (PERSONAJE NAV DROPDOWN) ---
    var pjMenu = document.getElementById('pj-nav-submenu');
    if (pjMenu) {
        var bb = getCleanBase();
        (function(menu, base) {
            fetch(base + '/game/ajax/my_personajes.php')
                .then(function(r){ return r.json() })
                .then(function(d){
                    if (!d.ok || !d.data) {
                        menu.innerHTML = '<li><a href="' + base + '/game/public/mis_personajes.php"><i class="fas fa-cog"></i> Gestionar Personajes</a></li>'
                        + '<li><a href="' + base + '/game/public/peticiones_general.php"><i class="fas fa-envelope-open-text"></i> Solicitudes</a></li>';
                        return;
                    }
                    var activeChar = null;
                    if (d.data.chars && d.data.chars.length > 0) {
                        d.data.chars.forEach(function(c){
                            if (c.is_active) activeChar = c;
                        });
                    }
                    var html = '<li><a href="' + base + '/game/public/mis_personajes.php"><i class="fas fa-cog"></i> Gestionar Personajes</a></li>'
                        + '<li><a href="' + base + '/game/public/peticiones_general.php"><i class="fas fa-clipboard-list"></i> Trámites</a></li>';
                    menu.innerHTML = html;

                    // Replace welcomeblock username with character name
                    if (activeChar) {
                        var wb = document.querySelector('.nav-welcome-text');
                        if (wb) {
                            // Keep the chevron, replace the username text
                            var text = wb.childNodes[0];
                            if (text) text.textContent = ' ' + activeChar.name + ' ';
                        }
                        // Show/hide admin/mod elements based on character's is_staff
                        if (activeChar.is_staff) {
                            document.body.classList.add('rpg-staff');
                        } else {
                            document.body.classList.remove('rpg-staff');
                        }
                        // Staff nav item: show/hide based on staff_level
                        var staffItem = document.getElementById('staff-nav-item');
                        var staffText = document.getElementById('staff-nav-text');
                        if (staffItem && staffText) {
                            var level = activeChar.staff_level || 0;
                            if (level > 0) {
                                staffItem.classList.remove('is-hidden');
                                var labels = {1: 'PANEL', 2: 'PANEL', 3: 'PANEL'};
                                var linkLabels = {1: 'Zona Colaborador', 2: 'Zona Moderador', 3: 'Zona Administrador'};
                                staffText.textContent = labels[level] || 'PANEL';
                                var staffLink = document.getElementById('staff-nav-link');
                                if (staffLink) {
                                    var linkText = staffLink.childNodes[0];
                                    if (linkText) linkText.textContent = linkLabels[level] || 'ZONA';
                                }
                            } else {
                                staffItem.classList.add('is-hidden');
                            }
                        }
                    }
                })
                .catch(function(){
                    menu.innerHTML = '<li><a href="' + base + '/game/public/mis_personajes.php"><i class="fas fa-cog"></i> Gestionar Personajes</a></li>'
                        + '<li><a href="' + base + '/game/public/peticiones_general.php"><i class="fas fa-clipboard-list"></i> Trámites</a></li>';
                });
        })(pjMenu, bb);
    }

    // Helper functions for postbit PJ card
    function getFactionSlug(factionName) {
        if (!factionName) return 'civil';
        var f = String(factionName).toLowerCase();
        if (f.indexOf('pirata') !== -1) return 'pirata';
        if (f.indexOf('marine') !== -1 || f.indexOf('marina') !== -1) return 'marine';
        if (f.indexOf('cazador') !== -1 || f.indexOf('cazar') !== -1) return 'cazador';
        if (f.indexOf('revolucion') !== -1) return 'revolucionario';
        if (f.indexOf('gobierno') !== -1) return 'gobierno';
        return 'civil';
    }

    function getFactionColor(slug) {
        var colors = {
            'pirata': '#D32F2F',
            'marine': '#1A237E',
            'cazador': '#1B5E20',
            'civil': '#4A148C',
            'revolucionario': '#d97706',
            'gobierno': '#64748b',
            'staff': '#111111'
        };
        return colors[slug] || colors.civil;
    }

    function rankCssClass(label) {
        var map = {
            'D': 'rpg-stat-rank--d', 'C': 'rpg-stat-rank--c', 'B': 'rpg-stat-rank--b',
            'A': 'rpg-stat-rank--a', 'S': 'rpg-stat-rank--s', 'SS': 'rpg-stat-rank--ss',
            'SS+': 'rpg-stat-rank--ss-plus', 'SS++': 'rpg-stat-rank--ss-plus-plus', 'SS+++': 'rpg-stat-rank--ss-beyond'
        };
        return map[label] || 'rpg-stat-rank--d';
    }

    function globalRankCssClass(rank) {
        var slug = String(rank || 'D').toLowerCase().replace(/[^a-z0-9+]/g, '') || 'd';
        return 'rpg-global-rank-badge--' + slug;
    }

    function generateStatsRanksHtml(c) {
        var attributes = ['fue', 'res', 'agi', 'des', 'int', 'inst', 'esp'];
        var labels = ['FUERZA', 'RESISTENCIA', 'AGILIDAD', 'DESTREZA', 'INTELECTO', 'INSTINTO', 'ESPÍRITU'];
        var icons = {
            'fue': 'fa-dumbbell', 'res': 'fa-shield-alt', 'agi': 'fa-running', 'des': 'fa-bullseye',
            'int': 'fa-brain', 'inst': 'fa-eye', 'esp': 'fa-fire'
        };
        var ranks = c.stats_ranks || {};
        var display = c.stats_effective_display || c.stats_display || {};
        var html = '';
        for (var i = 0; i < attributes.length; i++) {
            var key = attributes[i];
            var trained = parseInt(ranks[key], 10) || 1;
            var label = display[key] || 'D';
            html += '<div class="rpg-pj-stat-row rpg-pj-stat-row--rank">';
            html += '  <div class="rpg-pj-stat-label">';
            html += '    <span><i class="fas ' + icons[key] + '"></i> ' + labels[i] + '</span>';
            html += '    <span class="rpg-stat-rank ' + rankCssClass(label) + '">' + label + '</span>';
            html += '  </div>';
            html += '  <div class="rpg-stat-rank-track">';
            for (var seg = 1; seg <= 6; seg++) {
                html += '<span class="rpg-stat-rank-segment' + (seg <= trained ? ' rpg-stat-rank-segment--filled rpg-stat-rank-segment--' + key : '') + '"></span>';
            }
            html += '  </div>';
            html += '</div>';
        }
        return html;
    }

    // --- 6. POSTBIT: Replace with Character Info ---
    var postCards = document.querySelectorAll('.rpg-post-pjcard');
    if (postCards.length > 0) {
        var bb = getCleanBase();
        postCards.forEach(function(card) {
            var uid = card.getAttribute('data-uid');
            var postId = card.getAttribute('data-post-id');
            if (!uid) return;
            var url = bb + '/game/ajax/get_active_pj_for_user.php?uid=' + uid;
            if (postId) url += '&post_id=' + postId;
            fetch(url)
                .then(function(r){ return r.json() })
                .then(function(d){
                    if (d.ok && d.data) {
                        var c = d.data;
                        var img = card.querySelector('img');
                        if (img) {
                            img.src = c.avatar || bb + '/images/game/personaje_banner.png';
                            img.style.display = 'block';
                        }
                        
                        // Set attributes
                        var facSlug = getFactionSlug(c.is_staff ? 'staff' : c.faction);
                        card.setAttribute('data-faction', facSlug);
                        if (c.is_staff) {
                            card.classList.add('is-staff');
                        }

                        var nameEl = card.querySelector('.rpg-post-pj-character-name');
                        if (nameEl) {
                            var link = nameEl.querySelector('a');
                            if (link) {
                                link.href = bb + '/game/public/personaje.php?pj=' + c.id;
                                var span = link.querySelector('span');
                                if (span) {
                                    span.textContent = c.name;
                                } else {
                                    link.textContent = c.name;
                                }
                            } else {
                                nameEl.innerHTML = '<a href="' + bb + '/game/public/personaje.php?pj=' + c.id + '">' + c.name + '</a>';
                            }
                        }
                        
                        // Faction rank + global rank badge
                        var rankEl = card.querySelector('.rpg-post-pj-character-rank');
                        if (rankEl) rankEl.textContent = c.faction_rank || c.rango || '';
                        var globalRank = c.global_rank || 'D';
                        var globalBadge = card.querySelector('.rpg-post-pj-global-rank-hero') || card.querySelector('.rpg-post-pj-level-badge');
                        var globalVal = card.querySelector('.rpg-pj-global-rank-val');
                        if (globalVal) globalVal.textContent = globalRank;
                        if (globalBadge) {
                            globalBadge.className = 'rpg-post-pj-global-rank-hero rpg-global-rank-badge ' + globalRankCssClass(globalRank);
                        }

                        // Vitals Progress Bars
                        var pvCur = card.querySelector('.rpg-pj-pv-cur');
                        var pvMax = card.querySelector('.rpg-pj-pv-max');
                        var pvFill = card.querySelector('.rpg-pj-vital-bar-fill--pv');
                        if (pvCur && pvMax && pvFill) {
                            pvCur.textContent = c.current_pv;
                            pvMax.textContent = c.max_pv;
                            var pvPct = c.max_pv > 0 ? (c.current_pv / c.max_pv) * 100 : 100;
                            pvFill.style.width = Math.min(100, Math.max(0, pvPct)) + '%';
                        }
                        
                        var peCur = card.querySelector('.rpg-pj-pe-cur');
                        var peMax = card.querySelector('.rpg-pj-pe-max');
                        var peFill = card.querySelector('.rpg-pj-vital-bar-fill--pe');
                        if (peCur && peMax && peFill) {
                            peCur.textContent = c.current_pe;
                            peMax.textContent = c.max_pe;
                            var pePct = c.max_pe > 0 ? (c.current_pe / c.max_pe) * 100 : 100;
                            peFill.style.width = Math.min(100, Math.max(0, pePct)) + '%';
                        }

                        // Stats Progress Bars
                        var statsContainer = card.querySelector('.rpg-post-pj-stats');
                        if (statsContainer && (c.stats_ranks || c.stats)) {
                            statsContainer.innerHTML = generateStatsRanksHtml(c);
                        }
                    }
                })
                .catch(function(){});
        });
    }

    // --- 7. THREAD LIST: Replace author/lastposter usernames with character names ---
    var threadEls = document.querySelectorAll('.rpg-thread-author[data-uid], .rpg-thread-lastpost [data-uid]');
    if (threadEls.length > 0) {
        var bb = getCleanBase();
        threadEls.forEach(function(el) {
            var uid = el.getAttribute('data-uid');
            if (!uid) return;
            var threadId = el.getAttribute('data-thread-id');
            if (!threadId) {
                var row = el.closest('.rpg-thread-row, .trow1, .trow2, tr');
                if (row) {
                    var authorEl = row.querySelector('.rpg-thread-author');
                    if (authorEl) threadId = authorEl.getAttribute('data-thread-id');
                }
            }
            var url = bb + '/game/ajax/get_active_pj_for_user.php?uid=' + uid;
            if (threadId && el.closest('.rpg-thread-author')) {
                url += '&thread_id=' + threadId;
            } else if (threadId && el.closest('.rpg-thread-lastpost')) {
                url += '&last_post_for_thread_id=' + threadId;
            }
            fetch(url)
                .then(function(r){ return r.json() })
                .then(function(d){
                    if (d.ok && d.data) {
                        var link = el.querySelector('a');
                        if (link) {
                            var span = link.querySelector('span');
                            if (span) {
                                span.textContent = d.data.name;
                            } else {
                                link.textContent = d.data.name;
                            }
                        } else {
                            el.textContent = d.data.name;
                        }
                    }
                })
                .catch(function(){});
        });
    }

    // --- 8. NOTIFICATION BELL POLLING ---
    (function() {
        var bellBtn = document.getElementById('notification-bell');
        if (!bellBtn) return;
        var bb = getCleanBase();
        var badge = document.getElementById('notification-badge');
        function pollUnread() {
            fetch(bb + '/game/ajax/notifications_count.php?_t=' + Date.now())
                .then(function(r){ return r.json() })
                .then(function(d){
                    if (d.ok && d.data) {
                        var cnt = d.data.unread || 0;
                        if (cnt > 0) {
                            if (badge) {
                                badge.textContent = cnt > 99 ? '99+' : cnt;
                                badge.classList.remove('is-hidden');
                            }
                            bellBtn.classList.add('has-unread');
                        } else {
                            if (badge) badge.classList.add('is-hidden');
                            bellBtn.classList.remove('has-unread');
                        }
                    }
                })
                .catch(function(){});
        }
        pollUnread();
        setInterval(pollUnread, 30000);
    })();

    // --- 9. BOARD STATS: Replace newestmember/top user with character name ---
    var newestMemberEls = document.querySelectorAll('.rpg-stat-number a[href*="uid="]');
    if (newestMemberEls.length > 0) {
        var bb = getCleanBase();
        newestMemberEls.forEach(function(el) {
            var statTextDiv = el.closest('.rpg-stat-text');
            var isTopUsuario = false;
            if (statTextDiv) {
                var label = statTextDiv.querySelector('.rpg-stat-label');
                if (label && label.textContent.trim().toLowerCase().includes('top')) {
                    isTopUsuario = true;
                }
            }

            if (isTopUsuario) {
                fetch(bb + '/game/ajax/get_active_pj_for_user.php?global_top_poster=1')
                    .then(function(r){ return r.json() })
                    .then(function(d){
                        if (d.ok && d.data) {
                            el.textContent = d.data.name;
                        }
                    })
                    .catch(function(){});
            } else {
                var href = el.getAttribute('href');
                var uidMatch = href.match(/uid=(\d+)/);
                if (uidMatch && uidMatch[1]) {
                    var uid = uidMatch[1];
                    fetch(bb + '/game/ajax/get_active_pj_for_user.php?uid=' + uid + '&top_poster=1')
                        .then(function(r){ return r.json() })
                        .then(function(d){
                            if (d.ok && d.data) {
                                el.textContent = d.data.name;
                            }
                        })
                        .catch(function(){});
                }
            }
        });
    }
    // --- 10. THREAD META BADGES (type + on-rol date) ---
    (function() {
        var bb = getCleanBase();
        var badgeEls = document.querySelectorAll('.rpg-thread-header-badge[data-thread-id], .rpg-thread-meta-badge[data-thread-id]');
        if (badgeEls.length === 0) return;
        var catColors = {'Pasado':'#8b5cf6','Presente':'#10b981','Mision':'#f59e0b','Evento':'#3b82f6','Trama':'#ef4444','Fic':'#ec4899','Off_Rol':'#6b7280'};
        var seasonNames = ['Primavera','Verano','Otoño','Invierno'];
        var fetched = {};
        badgeEls.forEach(function(el) {
            var tid = el.getAttribute('data-thread-id');
            if (!tid || fetched[tid]) return;
            fetched[tid] = true;
            fetch(bb + '/game/ajax/get_thread_diary_data.php?thread_id=' + tid)
                .then(function(r){ return r.json() })
                .then(function(d){
                    if (!d.ok || !d.data) return;
                    var td = d.data;
                    var color = catColors[td.category] || '#6b7280';
                    var catLabel = td.category === 'Off_Rol' ? 'Off Rol' : td.category;
                    var dateStr = '';
                    if (td.day) {
                        var sName = seasonNames[td.season] || '?';
                        dateStr = td.day + ' ' + sName + ' ' + td.year;
                    }
                    var html = '<span class="rpg-meta-badge-wrap">';
                    html += '<span class="rpg-meta-type" style="--meta-bg:' + color + ';">' + catLabel + '</span>';
                    if (dateStr) {
                        html += '<span class="rpg-meta-date">' + dateStr + '</span>';
                    }
                    html += '</span>';
                    document.querySelectorAll('.rpg-thread-header-badge[data-thread-id="' + tid + '"], .rpg-thread-meta-badge[data-thread-id="' + tid + '"]').forEach(function(b) {
                        b.innerHTML = html;
                        b.classList.add('is-visible');
                    });
                })
                .catch(function(){});
        });
    })();

});

window.switchPJNav = function(pjId) {
    var menu = document.getElementById('pj-nav-submenu');
    var base = menu ? menu.getAttribute('data-base') || '' : '';
    var url = base + '/game/ajax/set_active_pj.php';
    var req = window.gamePostJson
        ? window.gamePostJson(url, { pj_id: pjId })
        : fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Mybb-Post-Key': window.GAME_CSRF || '' },
            credentials: 'same-origin',
            body: JSON.stringify({ pj_id: pjId, my_post_key: window.GAME_CSRF || '' })
        }).then(function (r) { return r.json(); });
    req.then(function (d) {
        if (d.ok) { location.reload(); }
        else { alert(d.error && d.error.message ? d.error.message : 'Error'); }
    })
    .catch(function(){ alert('Error de conexión'); });
};

// RPG System tabs (newthread / newreply / quickreply)
window.switchRpgTab = function(tabName, btn) {
    var container = btn.closest('.rpg-system-container');
    if (!container) return;
    container.querySelectorAll('.rpg-system-content').forEach(function(p) {
        p.classList.remove('active');
    });
    container.querySelectorAll('.rpg-system-tab-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    var tab = container.querySelector('#rpg-tab-' + tabName);
    if (tab) tab.classList.add('active');
    btn.classList.add('active');
};

document.addEventListener('DOMContentLoaded', function() {
    // 1. Setup Navbar Dropdown (siempre inicializado)
    var navToggle = document.getElementById('nav-welcome-toggle');
    var navAvatar = document.querySelector('.nav-avatar');
    if (navToggle) {
        var toggleDropdown = function(e) {
            if (e.target.closest('#nav-user-dropdown a')) return;
            e.stopPropagation();
            navToggle.classList.toggle('is-open');
        };
        navToggle.addEventListener('click', toggleDropdown);
        if (navAvatar) {
            navAvatar.addEventListener('click', toggleDropdown);
            navAvatar.style.cursor = 'pointer';
        }
        document.addEventListener('click', function(e) {
            if (!navToggle.contains(e.target) && (!navAvatar || !navAvatar.contains(e.target))) {
                navToggle.classList.remove('is-open');
            }
        });
    }

    // 2. Setup Card deck toggle
    var toggle = document.getElementById('rpg-card-toggle-btn');
    if (toggle && !toggle.dataset.rpgClearBound) {
        toggle.dataset.rpgClearBound = '1';
        toggle.addEventListener('change', function() {
            if (this.checked) return;
            var deckPanel = document.getElementById('rpg-card-deck-panel');
            if (deckPanel) {
                deckPanel.querySelectorAll('.rpg-selectable-card').forEach(function(cardEl) {
                    cardEl.classList.remove('selected');
                });
            }
            var input = document.getElementById('rpg_played_cards');
            if (input) input.value = '';
            if (typeof RpgHiddenActions !== 'undefined') {
                RpgHiddenActions.syncCardAvailability();
            }
        });
    }
});

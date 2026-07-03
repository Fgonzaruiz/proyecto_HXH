/* 
   RPG Custom Interactive Functions
   Theme Switcher, dynamic icons, and more.
*/

function applyRpgDataAttrs(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-bg]').forEach(function (el) {
        var url = el.getAttribute('data-bg');
        if (url) {
            el.style.backgroundImage = "url('" + String(url).replace(/'/g, '%27') + "')";
        }
    });
    scope.querySelectorAll('[data-pct]').forEach(function (el) {
        var pct = el.getAttribute('data-pct');
        if (pct == null || pct === '') return;
        el.style.width = String(pct).indexOf('%') >= 0 ? pct : pct + '%';
    });
    scope.querySelectorAll('[data-icon-bg]').forEach(function (el) {
        var bg = el.getAttribute('data-icon-bg');
        if (bg) el.style.setProperty('--icon-bg', bg);
    });
    scope.querySelectorAll('[data-icon-color]').forEach(function (el) {
        var c = el.getAttribute('data-icon-color');
        if (c) el.style.setProperty('--icon-color', c);
    });
    scope.querySelectorAll('[data-color]').forEach(function (el) {
        var c = el.getAttribute('data-color');
        if (!c) return;
        if (el.classList.contains('pj-tag') || el.classList.contains('pj-relation-tag')) {
            el.style.setProperty('--tag-color', c);
        }
        if (el.classList.contains('pj-color-swatch')) {
            el.style.setProperty('--swatch-color', c);
        }
        if (el.classList.contains('pj-cat-chip') || el.classList.contains('pj-timeline-item--cat')) {
            el.style.setProperty('--cat-color', c);
        }
        if (el.classList.contains('pj-linaje-perk-badge')) {
            el.style.setProperty('--badge-color', c);
        }
    });
    scope.querySelectorAll('[data-ev-color]').forEach(function (el) {
        var c = el.getAttribute('data-ev-color');
        if (c) el.style.setProperty('--ev-color', c);
    });
    scope.querySelectorAll('[data-cat-color]').forEach(function (el) {
        var c = el.getAttribute('data-cat-color');
        if (c) el.style.setProperty('--cat-color', c);
    });
    scope.querySelectorAll('[data-tag-color]').forEach(function (el) {
        var c = el.getAttribute('data-tag-color');
        if (c) el.style.setProperty('--tag-color', c);
    });
    scope.querySelectorAll('[data-grp-color]').forEach(function (el) {
        var c = el.getAttribute('data-grp-color');
        if (c) el.style.setProperty('--grp-color', c);
    });
    scope.querySelectorAll('[data-conn-color]').forEach(function (el) {
        var c = el.getAttribute('data-conn-color');
        if (c) el.style.setProperty('--conn-color', c);
    });
    scope.querySelectorAll('[data-status-color]').forEach(function (el) {
        var c = el.getAttribute('data-status-color');
        if (c) el.style.setProperty('--status-color', c);
    });
    scope.querySelectorAll('[data-card-img]').forEach(function (el) {
        var u = el.getAttribute('data-card-img');
        if (u) el.style.setProperty('--card-img', "url('" + String(u).replace(/'/g, '%27') + "')");
    });
}
window.applyRpgDataAttrs = applyRpgDataAttrs;

document.addEventListener("DOMContentLoaded", function() {
    applyRpgDataAttrs(document);
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
        'https://i.imgur.com/WqsnCYz.jpeg', 
        'https://i.imgur.com/Wrd4Sr4.jpeg'
    ];
    const randomHeroImg = heroImages[Math.floor(Math.random() * heroImages.length)];
    const heroSection = document.querySelector('.roleplay-hero');
    if (heroSection) {
        heroSection.style.backgroundImage = `url('${randomHeroImg}')`;
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
                    var h = '';
                    h += '<li><a href="' + base + '/game/public/mis_personajes.php"><i class="fas fa-cog"></i> Gestionar Personajes</a></li>';
                    h += '<li><a href="' + base + '/game/public/peticiones_general.php"><i class="fas fa-clipboard-list"></i> Trámites</a></li>';
                    menu.innerHTML = h;

                    // Replace welcomeblock username with character name
                    if (activeChar) {
                        var wb = document.querySelector('.nav-welcome-text');
                        if (wb) {
                            // Keep the chevron, replace the username text
                            var text = wb.childNodes[0];
                            if (text) text.textContent = ' ' + activeChar.name + ' ';
                        }
                        var navAvatar = document.querySelector('.nav-avatar');
                        if (navAvatar && activeChar.avatar) {
                            navAvatar.style.backgroundImage = "url('" + activeChar.avatar + "')";
                            navAvatar.style.backgroundSize = 'cover';
                            navAvatar.style.backgroundPosition = 'center';
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

                        fetch(base + '/game/ajax/dm_count.php', { credentials: 'same-origin' })
                            .then(function(r) { return r.json(); })
                            .then(function(res) {
                                if (!res.ok || !res.data) return;
                                var n = res.data.unread || 0;
                                var navBadge = document.getElementById('nav-dm-badge');
                                if (navBadge) {
                                    navBadge.textContent = n > 99 ? '99+' : n;
                                    navBadge.classList.toggle('is-hidden', n <= 0);
                                }
                            })
                            .catch(function() {});
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

                        // Signature
                        if (postId && c.firma_html) {
                            var sigWrap = document.getElementById('signature_' + postId);
                            if (sigWrap) {
                                var sigContent = sigWrap.querySelector('.rpg-post-pj-signature-content');
                                if (sigContent) {
                                    sigContent.innerHTML = c.firma_html;
                                    sigWrap.style.display = 'block';
                                }
                            }
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
                    var html = '<span style="display:inline-flex;align-items:center;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.3);margin-left:8px;vertical-align:middle;">';
                    html += '<span class="rpg-meta-type" style="padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#fff;background:' + color + ';">' + catLabel + '</span>';
                    if (dateStr) {
                        html += '<span class="rpg-meta-date">' + dateStr + '</span>';
                    }
                    html += '</span>';
                    document.querySelectorAll('.rpg-thread-header-badge[data-thread-id="' + tid + '"], .rpg-thread-meta-badge[data-thread-id="' + tid + '"]').forEach(function(b) {
                        b.innerHTML = html;
                        b.style.display = 'inline-flex';
                        b.style.alignItems = 'center';
                        b.style.gap = '6px';
                        b.style.flexWrap = 'wrap';
                    });
                })
                .catch(function(){});
        });
    })();

    // --- 11. CUSTOM PREMIUM BBCODE EDITOR TOOLBAR ---
    (function() {
        const textarea = document.getElementById('message');
        if (!textarea) return;

        // Prevent injecting the premium BBCode editor toolbar on the Quick Reply (Respuesta Rapida) form
        if (textarea.closest('.rpg-quickreply-container') || textarea.closest('#quick_reply_form')) {
            return;
        }

        if (textarea.dataset.rpgToolbarAdded || textarea.parentNode.querySelector('.rpg-editor-toolbar')) {
            return;
        }
        textarea.dataset.rpgToolbarAdded = '1';

        // Custom modal manager in DOM
        function createModal(id, title, iconClass, fields, onConfirm) {
            let backdrop = document.getElementById(id);
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.id = id;
                backdrop.className = 'rpg-modal-backdrop';
                
                let fieldHtml = '';
                fields.forEach(f => {
                    fieldHtml += `<div class="rpg-modal-group">
                        <label class="rpg-modal-label">${f.label}</label>`;
                    if (f.type === 'select') {
                        fieldHtml += `<select id="${id}-${f.name}" class="rpg-modal-select">`;
                        f.options.forEach(opt => {
                            fieldHtml += `<option value="${opt.value}">${opt.text}</option>`;
                        });
                        fieldHtml += `</select>`;
                    } else {
                        fieldHtml += `<input type="text" id="${id}-${f.name}" class="rpg-modal-input" placeholder="${f.placeholder || ''}" value="${f.value || ''}" />`;
                    }
                    fieldHtml += `</div>`;
                });

                backdrop.innerHTML = `
                    <div class="rpg-modal-container">
                        <div class="rpg-modal-header">
                            <h3 class="rpg-modal-title"><i class="${iconClass}"></i> ${title}</h3>
                            <button type="button" class="rpg-modal-close"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="rpg-modal-body">
                            ${fieldHtml}
                        </div>
                        <div class="rpg-modal-footer">
                            <button type="button" class="rpg-modal-btn rpg-modal-btn-cancel">Cancelar</button>
                            <button type="button" class="rpg-modal-btn rpg-modal-btn-confirm">Confirmar</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(backdrop);

                const closeBtn = backdrop.querySelector('.rpg-modal-close');
                const cancelBtn = backdrop.querySelector('.rpg-modal-btn-cancel');
                const confirmBtn = backdrop.querySelector('.rpg-modal-btn-confirm');

                const closeModal = () => {
                    backdrop.classList.remove('open');
                    fields.forEach(f => {
                        const el = document.getElementById(`${id}-${f.name}`);
                        if (el) el.value = f.value || '';
                    });
                };

                closeBtn.addEventListener('click', closeModal);
                cancelBtn.addEventListener('click', closeModal);
                backdrop.addEventListener('click', (e) => {
                    if (e.target === backdrop) closeModal();
                });

                confirmBtn.addEventListener('click', () => {
                    let data = {};
                    fields.forEach(f => {
                        const el = document.getElementById(`${id}-${f.name}`);
                        if (el) data[f.name] = el.value.trim();
                    });
                    onConfirm(data);
                    closeModal();
                });
            }

            return {
                open: () => {
                    backdrop.classList.add('open');
                    const firstInput = backdrop.querySelector('input');
                    if (firstInput) {
                        setTimeout(() => firstInput.focus(), 150);
                    }
                }
            };
        }

        // Create Modals
        const linkModal = createModal('rpg-modal-link', 'Insertar Enlace', 'fas fa-link', [
            { name: 'url', label: 'Dirección URL (Enlace)', placeholder: 'https://ejemplo.com', value: '' },
            { name: 'text', label: 'Texto de visualización', placeholder: 'Texto a mostrar (opcional)', value: '' }
        ], (data) => {
            if (!data.url) return;
            const linkText = data.text || data.url;
            insertBBCode(`[url=${data.url}]${linkText}`, '[/url]', true);
        });

        const imageModal = createModal('rpg-modal-image', 'Insertar Imagen', 'fas fa-image', [
            { name: 'url', label: 'Dirección URL de la Imagen', placeholder: 'https://ejemplo.com/imagen.jpg', value: '' },
            { name: 'width', label: 'Ancho (opcional)', placeholder: 'ej. 300', value: '' },
            { name: 'height', label: 'Alto (opcional)', placeholder: 'ej. 200', value: '' },
            { name: 'float', label: 'Maquetar y Flotar Texto (Ajuste)', type: 'select', value: '', options: [
                { value: '', text: 'Alineación normal (En su propia línea)' },
                { value: 'left', text: 'Flotar a la Izquierda (El texto fluye a la derecha)' },
                { value: 'right', text: 'Flotar a la Derecha (El texto fluye a la izquierda)' }
            ]}
        ], (data) => {
            if (!data.url) return;
            let alignAttr = data.float ? ` align=${data.float}` : '';
            let sizeAttr = '';
            if (data.width && data.height) {
                sizeAttr = `=${data.width}x${data.height}`;
            }
            insertBBCode(`[img${sizeAttr}${alignAttr}]${data.url}`, '[/img]');
        });

        const videoModal = createModal('rpg-modal-youtube', 'Insertar Video de YouTube', 'fas fa-video', [
            { name: 'url', label: 'Enlace o ID del video', placeholder: 'https://www.youtube.com/watch?v=...', value: '' }
        ], (data) => {
            if (!data.url) return;
            let id = data.url;
            const ytMatch = data.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
            if (ytMatch && ytMatch[1]) {
                id = ytMatch[1];
            }
            insertBBCode(`[youtube]${id}`, '[/youtube]');
        });

        const spoilerModal = createModal('rpg-modal-spoiler', 'Insertar Spoiler', 'fas fa-eye-slash', [
            { name: 'title', label: 'Título del Spoiler (opcional)', placeholder: 'ej. Contiene Spoilers de la Trama', value: '' }
        ], (data) => {
            if (data.title) {
                insertBBCode(`[spoiler=${data.title}]`, '[/spoiler]');
            } else {
                insertBBCode('[spoiler]', '[/spoiler]');
            }
        });

        // Create toolbar container
        const toolbar = document.createElement('div');
        toolbar.className = 'rpg-editor-toolbar';
        toolbar.style.display = 'flex';

        // Adjust textarea border radius
        textarea.style.borderRadius = '0 0 var(--radius-md) var(--radius-md)';
        textarea.style.marginTop = '0';

        // Helper to insert tag
        function insertBBCode(openTag, closeTag, replacesAll = false) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const selected = text.substring(start, end);
            
            let replacement;
            if (replacesAll) {
                replacement = openTag + (closeTag || '');
            } else {
                replacement = openTag + selected + (closeTag || '');
            }
            
            textarea.value = text.substring(0, start) + replacement + text.substring(end);
            textarea.focus();
            
            if (replacesAll) {
                textarea.selectionStart = start + replacement.length;
                textarea.selectionEnd = start + replacement.length;
            } else {
                textarea.selectionStart = start + openTag.length;
                textarea.selectionEnd = start + openTag.length + selected.length;
            }
        }

        // Helper to modify selection text
        function modifySelection(callback) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const selected = text.substring(start, end);
            if (!selected) return;
            const replacement = callback(selected);
            textarea.value = text.substring(0, start) + replacement + text.substring(end);
            textarea.focus();
            textarea.selectionStart = start;
            textarea.selectionEnd = start + replacement.length;
        }

        // Create a button
        function createBtn(icon, title, onClick) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = title;
            btn.className = 'rpg-editor-btn';
            btn.innerHTML = `<i class="${icon}"></i>`;
            btn.addEventListener('click', onClick);
            return btn;
        }

        // Create vertical divider
        function createGroupContainer() {
            const grp = document.createElement('div');
            grp.className = 'rpg-editor-group';
            return grp;
        }

        // Create custom JS-based dropdown menu
        function createDropdown(labelHtml, width = '150px') {
            const dropdown = document.createElement('div');
            dropdown.className = 'rpg-editor-dropdown';

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'rpg-editor-dropdown-trigger';
            trigger.innerHTML = labelHtml;
            dropdown.appendChild(trigger);

            const menu = document.createElement('div');
            menu.className = 'rpg-editor-dropdown-menu';
            menu.style.width = width;
            dropdown.appendChild(menu);

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close other dropdowns
                document.querySelectorAll('.rpg-editor-dropdown-menu').forEach(m => {
                    if (m !== menu) m.classList.remove('show');
                });
                menu.classList.toggle('show');
            });

            document.addEventListener('click', () => {
                menu.classList.remove('show');
            });

            return { dropdown, menu, trigger };
        }

        // --- GROUP 1: Format ---
        const formatGroup = createGroupContainer();
        formatGroup.appendChild(createBtn('fas fa-bold', 'Negrita', () => insertBBCode('[b]', '[/b]')));
        formatGroup.appendChild(createBtn('fas fa-italic', 'Cursiva', () => insertBBCode('[i]', '[/i]')));
        formatGroup.appendChild(createBtn('fas fa-underline', 'Subrayado', () => insertBBCode('[u]', '[/u]')));
        formatGroup.appendChild(createBtn('fas fa-strikethrough', 'Tachado', () => insertBBCode('[s]', '[/s]')));
        formatGroup.appendChild(createBtn('fas fa-subscript', 'Subíndice', () => insertBBCode('[sub]', '[/sub]')));
        formatGroup.appendChild(createBtn('fas fa-superscript', 'Superíndice', () => insertBBCode('[sup]', '[/sup]')));
        formatGroup.appendChild(createBtn('fas fa-eraser', 'Limpiar Formato', () => {
            modifySelection(text => text.replace(/\[\/?[^\]]+\]/g, ''));
        }));
        toolbar.appendChild(formatGroup);

        // --- GROUP 2: Typography, Sizes, Colors ---
        const styleGroup = createGroupContainer();

        // Typography Dropdown
        const fontDd = createDropdown('<span>Tipografía</span>', '160px');
        const fonts = ["Plus Jakarta Sans", "Space Grotesk", "Arial", "Times New Roman", "Courier New", "Georgia", "Impact"];
        fonts.forEach(f => {
            const item = document.createElement('div');
            item.className = 'rpg-editor-dropdown-item';
            item.textContent = f;
            item.style.fontFamily = f;
            item.addEventListener('click', () => {
                insertBBCode(`[font=${f}]`, '[/font]');
            });
            fontDd.menu.appendChild(item);
        });
        styleGroup.appendChild(fontDd.dropdown);

        // Size Dropdown
        const sizeDd = createDropdown('<span>Tamaño</span>', '110px');
        const sizes = [
            { value: "xx-small", label: "7px (Muy Pequeño)" },
            { value: "x-small", label: "9px" },
            { value: "small", label: "12px" },
            { value: "medium", label: "14px" },
            { value: "large", label: "18px" },
            { value: "x-large", label: "24px" },
            { value: "xx-large", label: "32px (Muy Grande)" }
        ];
        sizes.forEach(s => {
            const item = document.createElement('div');
            item.className = 'rpg-editor-dropdown-item';
            item.textContent = s.label;
            item.style.fontSize = s.value === 'xx-large' ? '18px' : (s.value === 'xx-small' ? '10px' : s.value);
            item.addEventListener('click', () => {
                insertBBCode(`[size=${s.value}]`, '[/size]');
            });
            sizeDd.menu.appendChild(item);
        });
        styleGroup.appendChild(sizeDd.dropdown);

        // Color Dropdown (Swatches + Free Pick)
        const colorDd = createDropdown('<i class="fas fa-palette" style="margin-right:2px;"></i><span>Color</span>', '170px');
        const colorGrid = document.createElement('div');
        colorGrid.className = 'rpg-color-grid';

        const paletteColors = [
            "#e11d48", "#be123c", "#10b981", "#047857", 
            "#3b82f6", "#1d4ed8", "#8b5cf6", "#6d28d9", 
            "#f59e0b", "#b45309", "#06b6d4", "#0891b2", 
            "#ec4899", "#be185d", "#ea580c", "#c2410c", 
            "#ffffff", "#94a3b8", "#475569", "#0f172a"
        ];
        paletteColors.forEach(hex => {
            const swatch = document.createElement('div');
            swatch.className = 'rpg-color-swatch';
            swatch.style.background = hex;
            swatch.addEventListener('click', () => {
                insertBBCode(`[color=${hex}]`, '[/color]');
            });
            colorGrid.appendChild(swatch);
        });

        // Native hidden color picker for custom picking
        const customColorWrapper = document.createElement('button');
        customColorWrapper.type = 'button';
        customColorWrapper.className = 'rpg-custom-color-btn';
        customColorWrapper.innerHTML = '<i class="fas fa-eye-dropper"></i> Personalizado';
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.style.display = 'none';
        customColorWrapper.appendChild(colorInput);
        
        customColorWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            colorInput.click();
        });

        colorInput.addEventListener('change', () => {
            insertBBCode(`[color=${colorInput.value}]`, '[/color]');
        });

        colorGrid.appendChild(customColorWrapper);
        colorDd.menu.appendChild(colorGrid);
        styleGroup.appendChild(colorDd.dropdown);

        toolbar.appendChild(styleGroup);

        // --- GROUP 3: Alignment ---
        const alignGroup = createGroupContainer();
        alignGroup.appendChild(createBtn('fas fa-align-left', 'Alinear a la Izquierda', () => insertBBCode('[align=left]', '[/align]')));
        alignGroup.appendChild(createBtn('fas fa-align-center', 'Centrar', () => insertBBCode('[align=center]', '[/align]')));
        alignGroup.appendChild(createBtn('fas fa-align-right', 'Alinear a la Derecha', () => insertBBCode('[align=right]', '[/align]')));
        alignGroup.appendChild(createBtn('fas fa-align-justify', 'Justificar', () => insertBBCode('[align=justify]', '[/align]')));
        toolbar.appendChild(alignGroup);

        // --- GROUP 4: Structural Lists, Separator & Interactive Table grid ---
        const structGroup = createGroupContainer();
        structGroup.appendChild(createBtn('fas fa-list-ul', 'Lista de Viñetas', () => insertBBCode('[list]\n[*]', '\n[/list]')));
        structGroup.appendChild(createBtn('fas fa-list-ol', 'Lista Numerada', () => insertBBCode('[list=1]\n[*]', '\n[/list]')));
        structGroup.appendChild(createBtn('fas fa-minus', 'Línea Horizontal', () => insertBBCode('[hr]\n', '')));

        // Table visual grid dropdown selector
        const tableDd = createDropdown('<i class="fas fa-table" style="margin-right:2px;"></i><span>Tabla</span>', '150px');
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'rpg-table-grid-wrapper';

        const grid = document.createElement('div');
        grid.className = 'rpg-table-grid';

        const gridStatus = document.createElement('div');
        gridStatus.className = 'rpg-table-grid-label';
        gridStatus.textContent = 'Tabla de 1x1';

        // 5x5 Grid construction
        const maxRows = 5;
        const maxCols = 5;
        for (let r = 1; r <= maxRows; r++) {
            for (let c = 1; c <= maxCols; c++) {
                const cell = document.createElement('div');
                cell.className = 'rpg-table-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                cell.addEventListener('mouseover', () => {
                    gridStatus.textContent = `Tabla de ${r}x${c}`;
                    grid.querySelectorAll('.rpg-table-cell').forEach(cellEl => {
                        const cellRow = parseInt(cellEl.dataset.row);
                        const cellCol = parseInt(cellEl.dataset.col);
                        if (cellRow <= r && cellCol <= c) {
                            cellEl.classList.add('highlighted');
                        } else {
                            cellEl.classList.remove('highlighted');
                        }
                    });
                });

                cell.addEventListener('click', () => {
                    let tableCode = '[table]\n';
                    for (let tr = 0; tr < r; tr++) {
                        tableCode += '  [tr]\n';
                        for (let td = 0; td < c; td++) {
                            tableCode += '    [td]Celda[/td]\n';
                        }
                        tableCode += '  [/tr]\n';
                    }
                    tableCode += '[/table]';
                    insertBBCode(tableCode, '', true);
                });

                grid.appendChild(cell);
            }
        }

        grid.addEventListener('mouseleave', () => {
            grid.querySelectorAll('.rpg-table-cell').forEach(cellEl => {
                cellEl.classList.remove('highlighted');
            });
            gridStatus.textContent = 'Tabla de 1x1';
        });

        gridWrapper.appendChild(grid);
        gridWrapper.appendChild(gridStatus);
        tableDd.menu.appendChild(gridWrapper);
        structGroup.appendChild(tableDd.dropdown);

        toolbar.appendChild(structGroup);

        // --- GROUP 5: Media & Link popup modals ---
        const mediaGroup = createGroupContainer();
        mediaGroup.appendChild(createBtn('fas fa-link', 'Insertar Enlace', () => linkModal.open()));
        mediaGroup.appendChild(createBtn('fas fa-image', 'Insertar Imagen (con Ajuste)', () => imageModal.open()));
        mediaGroup.appendChild(createBtn('fas fa-video', 'Insertar Video YouTube', () => videoModal.open()));
        toolbar.appendChild(mediaGroup);

        // --- GROUP 6: Emojis, Spoilers, Quotes and Utilities ---
        const advancedGroup = createGroupContainer();
        advancedGroup.appendChild(createBtn('fas fa-quote-left', 'Insertar Cita', () => insertBBCode('[quote]', '[/quote]')));
        advancedGroup.appendChild(createBtn('fas fa-code', 'Bloque de Código', () => insertBBCode('[code]', '[/code]')));
        advancedGroup.appendChild(createBtn('fas fa-eye-slash', 'Insertar Spoiler', () => spoilerModal.open()));

        // Emojis Dropdown
        const emojiDd = createDropdown('<i class="far fa-smile"></i>', '220px');
        const emojiGrid = document.createElement('div');
        emojiGrid.className = 'rpg-emojis-wrapper';
        const emojis = [
            "😀", "😂", "😍", "😎", "😉", "😭", "😡", "👍", "💖", "🔥",
            "🎉", "🚀", "💡", "🌟", "💀", "👑", "⚔️", "🛡️", "⛵", "🗺️",
            "🐾", "🍷", "🍕", "💤"
        ];
        emojis.forEach(emo => {
            const item = document.createElement('div');
            item.className = 'rpg-emoji-item';
            item.textContent = emo;
            item.addEventListener('click', () => {
                insertBBCode(emo, '');
            });
            emojiGrid.appendChild(item);
        });
        emojiDd.menu.appendChild(emojiGrid);
        advancedGroup.appendChild(emojiDd.dropdown);

        // Text Utilities Dropdown
        const utilDd = createDropdown('<i class="fas fa-cog"></i>', '130px');
        
        const optUpper = document.createElement('div');
        optUpper.className = 'rpg-editor-dropdown-item';
        optUpper.innerHTML = '<i class="fas fa-font" style="margin-right:6px;"></i>MAYÚSCULAS';
        optUpper.addEventListener('click', () => modifySelection(text => text.toUpperCase()));
        utilDd.menu.appendChild(optUpper);

        const optLower = document.createElement('div');
        optLower.className = 'rpg-editor-dropdown-item';
        optLower.innerHTML = '<i class="fas fa-font" style="margin-right:6px;font-size:10px;"></i>minúsculas';
        optLower.addEventListener('click', () => modifySelection(text => text.toLowerCase()));
        utilDd.menu.appendChild(optLower);

        const optCap = document.createElement('div');
        optCap.className = 'rpg-editor-dropdown-item';
        optCap.innerHTML = '<i class="fas fa-heading" style="margin-right:6px;"></i>Capitalizar';
        optCap.addEventListener('click', () => modifySelection(text => {
            return text.replace(/\b\w/g, c => c.toUpperCase());
        }));
        utilDd.menu.appendChild(optCap);

        advancedGroup.appendChild(utilDd.dropdown);

        toolbar.appendChild(advancedGroup);

        // Insert toolbar before textarea
        textarea.parentNode.insertBefore(toolbar, textarea);

        // Observe textarea visibility/style to hide toolbar if SCEditor is loaded
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style') {
                    if (window.getComputedStyle(textarea).display === 'none') {
                        toolbar.style.display = 'none';
                    } else {
                        toolbar.style.display = 'flex';
                    }
                }
            });
        });
        observer.observe(textarea, { attributes: true });
        
        if (window.getComputedStyle(textarea).display === 'none') {
            toolbar.style.display = 'none';
        }
    })();


});

function initDataBg() {
    document.querySelectorAll('[data-bg]').forEach(function (el) {
        var u = el.getAttribute('data-bg');
        if (u) {
            el.style.backgroundImage = "url('" + String(u).replace(/'/g, "%27") + "')";
        }
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDataBg);
} else {
    initDataBg();
}

window.switchPJNav = function(pjId) {
    var menu = document.getElementById('pj-nav-submenu');
    var base = menu ? menu.getAttribute('data-base') || '' : '';
    fetch(base + '/game/ajax/set_active_pj.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pj_id: pjId })
    })
    .then(function(r){ return r.json() })
    .then(function(d){
        if (d.ok) { location.reload(); }
        else { alert(d.error.message); }
    })
    .catch(function(){ alert('Error de conexión'); });
};

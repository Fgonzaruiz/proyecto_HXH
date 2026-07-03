/**
 * Motor del Sistema de Cartas RPG
 * Maneja el renderizado de cartas, inventario de personaje, selector en posts y visualización.
 */

const RpgCards = {
    // Configuración base
    config: {
        baseUrl: '',
        debugPost: false,
        rankColors: {
            'C': '#94a3b8',
            'B': '#10b981',
            'A': '#3b82f6',
            'S': '#8b5cf6',
            'SS': 'linear-gradient(135deg, #f59e0b, #ef4444)'
        }
    },

    // Cache para texto completo de cartas (truncación)
    _cardDataCache: {},
    // Modificadores activos para el turno actual
    _modifiers: {},
    // Modificadores de tirada por carta en el selector: { card_id: { dice: {d4:0, d6:0, ...}, flat: 0 } }
    _rollModifiers: {},
    // Interactive cooldown overrides: { card_id: remaining_turns }
    _cooldownMods: {},
    // Currently selected card IDs in the post editor
    selectedCards: [],

    _cardRankAttr: function(c) {
        return ' data-rank="' + (c.rank || 'C') + '"';
    },

    _cardIdInt: function(id) {
        return parseInt(id, 10) || 0;
    },

    _postDebugEnabled: function() {
        if (this.config.debugPost || window.RPG_DEBUG_POST === true) return true;
        try {
            return window.localStorage && window.localStorage.getItem('rpg_debug_post') === '1';
        } catch (e) {
            return false;
        }
    },

    _postDebugLog: function(event, data) {
        if (!this._postDebugEnabled()) return;
        var msg = '[RpgCards] ' + event;
        if (data !== undefined) {
            console.log(msg, data);
        } else {
            console.log(msg);
        }
    },

    requiresEquippedSlot: function(card) {
        if (!card) return false;
        if (RpgCards.isConsumibleCard(card)) return false;
        var cardType = card.card_type || card;
        return cardType === 'equipo' || cardType === 'npc_menor' || cardType === 'barco';
    },

    filterPostDeckCards: function(cards, meta, forceEquippedOnly) {
        if (!cards || !cards.length) return cards || [];
        var equippedOnly = forceEquippedOnly || (meta && meta.equipped_only);
        if (!equippedOnly) return cards;
        if (!meta || !Array.isArray(meta.equipped_card_ids)) {
            return cards;
        }
        var equipped = meta.equipped_card_ids.map(function(x) { return RpgCards._cardIdInt(x); });
        return cards.filter(function(c) {
            if (!RpgCards.requiresEquippedSlot(c)) return true;
            return equipped.indexOf(RpgCards._cardIdInt(c.id)) !== -1;
        });
    },

    isConsumibleCard: function(c) {
        if (!c) return false;
        if (c.is_consumible === true) return true;
        if (c.is_consumible === false) return false;
        if (c.card_type !== 'equipo') return false;
        var ef = c.effects || {};
        if (String(ef.equipo_type || '').toLowerCase() === 'util') return true;
        var tags = c.tags || [];
        if (!Array.isArray(tags)) return false;
        return tags.some(function(t) {
            var u = String(t).toUpperCase();
            return u === 'CONSUMIBLE' || u === 'MUNICION' || u === 'AMMO';
        });
    },

    _qtyBadgeHtml: function(c) {
        if (!this.isConsumibleCard(c)) return '';
        if (c.cantidad === undefined || c.cantidad === null) return '';
        var qty = parseInt(c.cantidad, 10);
        if (isNaN(qty)) return '';
        var qtyClass = qty <= 2 ? 'rpg-card-qty-badge--low' : 'rpg-card-qty-badge--ok';
        return '<span class="rpg-card-qty-badge ' + qtyClass + '">×' + qty + '</span>';
    },

    _consumibleDisabledState: function(c) {
        if (!this.isConsumibleCard(c)) return null;
        var qty = parseInt(c.cantidad, 10);
        if (isNaN(qty) || qty > 0) return null;
        return {
            isDisabled: true,
            disabledAttr: 'data-disabled="true" data-exhausted-disabled="true"',
            overlayHtml:
                '<div class="rpg-card-empty-overlay">' +
                    '<i class="fas fa-box-open"></i>' +
                    '<div class="rpg-card-empty-overlay__title">Agotado</div>' +
                '</div>'
        };
    },

    _cardImageHtml: function(c) {
        if (!c.image_url || !c.image_url.trim()) return '';
        var url = String(c.image_url).replace(/'/g, '%27');
        return '<div class="rpg-card-image rpg-card-image--has-img" style="--card-img:url(\'' + url + '\')"></div>';
    },

    hideCardTextModal: function() {
        var modal = document.getElementById('rpg-text-modal');
        if (modal) modal.classList.remove('is-open');
    },

    init: function() {
        const nav = document.getElementById('pj-nav-submenu');
        if (nav && nav.dataset.base) {
            this.config.baseUrl = nav.dataset.base;
        } else {
            const gameIdx = window.location.pathname.toLowerCase().indexOf('/game/');
            if (gameIdx !== -1) {
                this.config.baseUrl = window.location.origin + window.location.pathname.substring(0, gameIdx);
            } else {
                const firstFolder = window.location.pathname.split('/')[1] || '';
                if (firstFolder.toLowerCase() === 'foro') {
                    this.config.baseUrl = window.location.origin + '/' + firstFolder;
                } else {
                    this.config.baseUrl = window.location.origin;
                }
            }
        }

        try {
            this.config.debugPost = window.localStorage && window.localStorage.getItem('rpg_debug_post') === '1';
        } catch (e) {}

        this._postDebugLog('init', { baseUrl: this.config.baseUrl });

        // 1. Mostrar cartas en los posts
        this.loadPostCards();

        // 2. Inicializar selector en editor de texto (Quick Reply / New Reply)
        this.initCardSelector();

        // 3. Cargar deck en perfil de personaje si estamos en esa página
        const deckContainer = document.getElementById('rpg-character-deck-container');
        if (deckContainer && deckContainer.dataset.charId) {
            this.loadCharacterDeck(deckContainer.dataset.charId, deckContainer);
        }

        if (document.getElementById('rpg-nav-panel') && window.RpgNavigation && typeof RpgNavigation.init === 'function') {
            RpgNavigation.init();
        }
    },

    // ──────────────────────────────────────────────────────────────────────────
    // TRUNCACIÓN DE TEXTO
    // ──────────────────────────────────────────────────────────────────────────

    truncateDesc: function(text, cacheKey, cardName, limit) {
        limit = limit || 150;
        if (!text || text.length <= limit) return text;
        var uid = 'td_' + cacheKey + '_' + Math.random().toString(36).slice(2, 6);
        this._cardDataCache[uid] = { name: cardName, text: text };
        return text.substring(0, limit).trim() +
            '... <span class="rpg-ver-mas-link" onclick="RpgCards.showCardTextModal(\'' + uid + '\')">[Ver más]</span>';
    },

    showCardTextModal: function(uid) {
        var data = this._cardDataCache[uid];
        if (!data) return;
        var modal = document.getElementById('rpg-text-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'rpg-text-modal';
            modal.className = 'rpg-text-modal';
            modal.innerHTML =
                '<div class="rpg-text-modal__dialog">' +
                    '<div class="rpg-text-modal__header">' +
                        '<div id="rpg-text-modal-title" class="rpg-text-modal__title"></div>' +
                        '<button type="button" class="rpg-text-modal__close" onclick="RpgCards.hideCardTextModal()">&times;</button>' +
                    '</div>' +
                    '<div id="rpg-text-modal-body" class="rpg-text-modal__body"></div>' +
                '</div>';
            document.body.appendChild(modal);
            modal.addEventListener('click', function(e) { if (e.target === modal) RpgCards.hideCardTextModal(); });
        }
        document.getElementById('rpg-text-modal-title').textContent = data.name;
        document.getElementById('rpg-text-modal-body').textContent = data.text;
        modal.classList.add('is-open');
    },

    // ──────────────────────────────────────────────────────────────────────────
    // PANEL DE MODIFICADORES
    // ──────────────────────────────────────────────────────────────────────────

    addModifier: function() {
        /* legacy no-op: use tab Estadísticas steppers */
    },

    removeModifier: function(stat) {
        if (this._modifiers) delete this._modifiers[stat];
        if (typeof RpgStats !== 'undefined') RpgStats.syncSteppers();
        this._renderModifierList();
        this._updateModifiersInput();
    },

    _renderModifierList: function() {
        var list = document.getElementById('rpg-modifier-list');
        if (!list) return;
        list.innerHTML = '';
        for (var stat in (this._modifiers || {})) {
            if (!Object.prototype.hasOwnProperty.call(this._modifiers, stat)) continue;
            var val = this._modifiers[stat];
            if (val === 0) continue;
            var modClass = val > 0 ? 'rpg-modifier-chip--buff' : 'rpg-modifier-chip--debuff';
            var sign = val > 0 ? '+' : '';
            var base = parseInt((typeof RpgStats !== 'undefined' && RpgStats._baseRanks[stat]) || 1, 10);
            var resultLabel = (typeof RpgStats !== 'undefined') ? RpgStats._rankLabel(base + parseInt(val, 10)) : '';
            list.innerHTML += '<span class="rpg-modifier-chip ' + modClass + '" onclick="RpgCards.removeModifier(\'' + stat + '\')" title="Click para eliminar">' +
                stat.toUpperCase() + ' \u2192 ' + resultLabel + ' (' + sign + val + ') <i class="fas fa-times"></i></span>';
        }
    },

    _updateModifiersInput: function() {
        var input = document.getElementById('rpg_modifiers');
        if (!input) return;
        input.value = JSON.stringify(this._modifiers || {});
    },

    adjustStatMod: function(stat, delta) {
        if (!stat || !delta) return;
        if (!this._modifiers) this._modifiers = {};
        this._modifiers[stat] = (this._modifiers[stat] || 0) + delta;
        if (this._modifiers[stat] === 0) delete this._modifiers[stat];
        if (typeof RpgStats !== 'undefined') RpgStats.syncSteppers();
        this._renderModifierList();
        this._updateModifiersInput();
    },

    _injectModifierPanel: function(container) {
        /* deprecated: modifiers moved to tab Estadísticas (RpgStats) */
    },

    // ──────────────────────────────────────────────────────────────────────────
    // RENDERIZADO DE CARTAS
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Genera el HTML de una carta (diseño premium)
     */
    renderCard: function(c) {
        var isHolo   = c.rank === 'SS' ? 'rpg-card--holo' : '';
        var rankAttr = this._cardRankAttr(c);
        var self     = this;

        var tagsHtml = '';
        if (c.tags && c.tags.length > 0) {
            tagsHtml = '<div class="rpg-card-tags">';
            c.tags.forEach(function(t) {
                var cleanedTag = t.replace(/[\[\]]/g, '').trim().toUpperCase();
                if (cleanedTag) {
                    tagsHtml += '<span class="rpg-card-tag">' + cleanedTag + '</span>';
                }
            });
            tagsHtml += '</div>';
        }

        var rollHtml = '';
        if (c.roll_result && c.roll_result.trim() !== '') {
            var rollLabel = c.card_type === 'npc_menor' ? 'Acci�n Ejecutada' : 'Resultado de Tirada';
            var rollIcon  = c.card_type === 'npc_menor' ? 'fas fa-paw' : 'fas fa-dice';
            var modBadge = c.is_modified ? ' <span class="rpg-card-modified-badge">Modificada</span>' : '';
            rollHtml = '<div class="rpg-card-roll-result">' +
                '<div class="rpg-card-roll-result__label"><i class="' + rollIcon + '"></i> ' + rollLabel + modBadge + '</div>' +
                '<div class="rpg-card-roll-result__text">' + c.roll_result.replace(/\n/g, '<br>') + '</div>' +
                '</div>';
        }

        var durationText = (c.duracion && c.duracion > 0) ? ' \u00B7 DURACI\u00d3N: ' + c.duracion + 'T' : '';
        var reposoText   = (c.reposo   && c.reposo   > 0) ? ' \u00B7 REPOSO: '   + c.reposo   + 'T' : '';


        // ── EQUIPO ───────────────────────────────────────────────────────────
        if (c.card_type === 'equipo') {
            var effects  = c.effects || {};
            var eqType   = (effects.equipo_type || 'util').toLowerCase();
            var subtype  = effects.subtipo || '';
            var eqTypeLabel = 'EQUIPO: ' + eqType.toUpperCase() + (subtype ? ' (' + subtype + ')' : '');

            var eqStatsHtml = '';
            if (eqType === 'arma') {
                var dmgDice = effects.damage_dice || c.dice || '—';
                var dmgStat = (effects.damage_stat || c.execution_stat || '').toUpperCase();
                var dmgFormula = dmgStat ? dmgDice + ' + ' + dmgStat : dmgDice;
                eqStatsHtml = '<div class="rpg-card-stats-row rpg-card-stats-row--weapon">' +
                    '<div><span><i class="fas fa-sword"></i> DAÑO</span><strong>' + dmgFormula + '</strong></div>' +
                    '</div>';
            } else if (eqType !== 'armadura' && c.dice && c.dice !== '—' && c.dice.trim() !== '') {
                // Útiles / munición: mostrar dado aplicado
                eqStatsHtml = '<div class="rpg-card-stats-row">' +
                    '<div><span><i class="fas fa-dice-d6"></i> DADO</span><strong>' + c.dice + '</strong></div>' +
                    '</div>';
            }

            return '<div class="rpg-card rpg-card--equipo rpg-card--equipo-' + eqType + ' ' + isHolo + '" data-card-id="' + c.id + '"' + rankAttr + '>' +
                '<div class="rpg-card-header">' +
                    '<div class="rpg-card-title">' + c.name + '</div>' +
                    '<div class="rpg-card-subtitle">[CALIDAD ' + c.rank + '] ' + eqTypeLabel + '</div>' +
                '</div>' +
                self._cardImageHtml(c) +
                '<div class="rpg-card-body">' +
                    tagsHtml +
                    eqStatsHtml +
                    '<div class="rpg-card-desc">' + self.truncateDesc(c.description, c.id, c.name) + '</div>' +
                    rollHtml +
                '</div>' +
            '</div>';
        }

        // ── BARCO ────────────────────────────────────────────────────────────
        if (c.card_type === 'barco') {
            var effects     = c.effects || {};
            var bType       = effects.barco_type || 'Navío';
            var tier        = effects.tier        || 1;
            var vida        = effects.vida        || 100;
            var ataque      = effects.ataque      || 0;
            var velocidad   = effects.velocidad   || 0;
            var resistencia = effects.resistencia || 0;

            var shipStatsHtml =
                '<div class="rpg-card-ship-grid">' +
                    '<div class="rpg-card-ship-stat"><span><i class="fas fa-anchor"></i> TIER</span><strong>' + tier + '</strong></div>' +
                    '<div class="rpg-card-ship-stat"><span><i class="fas fa-heart"></i> VIDA</span><strong>' + vida + '</strong></div>' +
                    '<div class="rpg-card-ship-stat"><span><i class="fas fa-swords"></i> ATK</span><strong>' + ataque + '</strong></div>' +
                    '<div class="rpg-card-ship-stat"><span><i class="fas fa-wind"></i> VEL</span><strong>' + velocidad + '</strong></div>' +
                    '<div class="rpg-card-ship-stat rpg-card-ship-stat--wide"><span><i class="fas fa-shield-halved"></i> RESISTENCIA</span><strong>' + resistencia + '</strong></div>' +
                '</div>';

            return '<div class="rpg-card rpg-card--barco ' + isHolo + '" data-card-id="' + c.id + '"' + rankAttr + '>' +
                '<div class="rpg-card-header">' +
                    '<div class="rpg-card-title">' + c.name + '</div>' +
                    '<div class="rpg-card-subtitle">[TIER ' + tier + '] BARCO • ' + bType.toUpperCase() + '</div>' +
                '</div>' +
                self._cardImageHtml(c) +
                '<div class="rpg-card-body">' +
                    shipStatsHtml +
                    '<div class="rpg-card-desc">' + self.truncateDesc(c.description, c.id, c.name) + '</div>' +
                    rollHtml +
                '</div>' +
            '</div>';
        }

        // ── NPC MENOR / MASCOTA ──────────────────────────────────────────────
        if (c.card_type === 'npc_menor') {
            var effects  = c.effects || {};
            var npcType  = (effects.npc_mascota_type || 'npc').toLowerCase();
            var vida     = effects.vida || 50;
            var tier     = effects.tier || 1;
            var subLabel = npcType === 'mascota' ? 'MASCOTA • TIER ' + tier : 'NPC MENOR';

            var npcStatsHtml =
                '<div class="rpg-card-stats-row">' +
                    '<div><span><i class="fas fa-heart"></i> VIDA</span><strong>' + vida + ' HP</strong></div>' +
                '</div>';

            var actionsHtml = '';
            var rawActions  = effects.acciones || [];
            var actionsList = typeof rawActions === 'string'
                ? rawActions.split('\n').map(function(a){ return a.trim(); }).filter(Boolean)
                : rawActions;
            if (actionsList && actionsList.length > 0) {
                actionsHtml = '<div class="rpg-card-actions-list-container"><span class="rpg-card-section-title"><i class="fas fa-swords"></i> ACCIONES</span>';
                actionsList.forEach(function(act) {
                    actionsHtml += '<div class="rpg-card-action-item"><i class="fas fa-paw"></i> ' + act + '</div>';
                });
                actionsHtml += '</div>';
            }

            return '<div class="rpg-card rpg-card--npc-menor rpg-card--npc-' + npcType + ' ' + isHolo + '" data-card-id="' + c.id + '"' + rankAttr + '>' +
                '<div class="rpg-card-header">' +
                    '<div class="rpg-card-title">' + c.name + '</div>' +
                    '<div class="rpg-card-subtitle">' + subLabel + '</div>' +
                '</div>' +
                self._cardImageHtml(c) +
                '<div class="rpg-card-body">' +
                    npcStatsHtml +
                    '<div class="rpg-card-desc">' + self.truncateDesc(c.description, c.id, c.name) + '</div>' +
                    actionsHtml +
                    rollHtml +
                '</div>' +
            '</div>';
        }

        // ── HAKI ─────────────────────────────────────────────────────────────
        if (c.card_type === 'haki') {
            var effects  = c.effects || {};
            var hakiType = (effects.haki_type || 'busoshoku').toLowerCase();
            if (hakiType === 'busshoku')   hakiType = 'busoshoku';
            if (hakiType === 'kenboshuko') hakiType = 'kenbunshoku';

            var hakiLevel = (effects.haki_level || 'basico').toLowerCase();

            var hakiTypeName = 'Busoshoku (Armamento)';
            if (hakiType === 'kenbunshoku') hakiTypeName = 'Kenbunshoku (Observación)';
            else if (hakiType === 'haoshoku') hakiTypeName = 'Haoshoku (Conquistador)';

            var typeLabel   = 'HAKI: ' + hakiTypeName.toUpperCase();
            var levelLabel  = hakiLevel.toUpperCase();
            var efectoText  = effects.efecto || c.description || 'Sin efecto específico registrado.';

            return '<div class="rpg-card rpg-card--haki rpg-card--haki-' + hakiType + ' ' + isHolo + '" data-card-id="' + c.id + '"' + rankAttr + '>' +
                '<div class="rpg-card-header">' +
                    '<div class="rpg-card-title">' + c.name + '</div>' +
                    '<div class="rpg-card-subtitle haki-type-label">' +
                        '<span class="haki-level-badge">[' + levelLabel + ']</span> ' + typeLabel +
                    '</div>' +
                '</div>' +
                self._cardImageHtml(c) +
                '<div class="rpg-card-body">' +
                    (c.description ? '<div class="rpg-card-desc">' + self.truncateDesc(c.description, c.id, c.name) + '</div>' : '') +
                    '<div class="rpg-card-section rpg-card-section--efecto">' +
                        '<span class="rpg-card-section-title"><i class="fas fa-shield-halved"></i> EFECTO</span>' +
                        '<div class="rpg-card-section-text">' + self.truncateDesc(efectoText, c.id + '_ef', c.name + ' — Efecto') + '</div>' +
                    '</div>' +
                    rollHtml +
                '</div>' +
            '</div>';
        }

        // ── TÉCNICA (estándar) ───────────────────────────────────────────────
        var typeText  = c.card_type.replace('_', ' ').toUpperCase();
        var rankLabel = 'RANGO';

        var statsHtml = '';
        var execCost = parseInt(c.execution_cost || 0);
        if (c.cost_pe !== '—' || c.execution_stat !== '' || c.dice !== '' || execCost > 0) {
            statsHtml = '<div class="rpg-card-stats-row">';
            if (c.cost_pe !== '—') statsHtml += '<div><span>COSTE</span><strong>' + c.cost_pe + '</strong></div>';
            if (execCost > 0) statsHtml += '<div><span>P.A</span><strong>' + execCost + '</strong></div>';
            if (c.execution_stat !== '') statsHtml += '<div><span>STAT</span><strong>' + c.execution_stat + '</strong></div>';
            if (c.dice !== '') statsHtml += '<div><span>DADOS</span><strong>' + c.dice + '</strong></div>';
            statsHtml += '</div>';
        }

        return '<div class="rpg-card ' + isHolo + '" data-card-id="' + c.id + '"' + rankAttr + '>' +
            '<div class="rpg-card-header">' +
                '<div class="rpg-card-title">' + c.name + '</div>' +
                '<div class="rpg-card-subtitle">[' + rankLabel + ' ' + c.rank + '] ' + typeText + ' \u00B7 ' + (c.activation || '').toUpperCase() + durationText + reposoText + '</div>' +
            '</div>' +
            self._cardImageHtml(c) +
            '<div class="rpg-card-body">' +
                tagsHtml +
                statsHtml +
                '<div class="rpg-card-desc">' + self.truncateDesc(c.description, c.id, c.name) + '</div>' +
                rollHtml +
            '</div>' +
        '</div>';
    },

    // ──────────────────────────────────────────────────────────────────────────
    // DECK DE PERSONAJE (TAB PERFIL — colapsable por tipo)
    // ──────────────────────────────────────────────────────────────────────────

    loadCharacterDeck: function(charId, container) {
        var self = this;
        fetch(this.config.baseUrl + '/game/ajax/cards_my_deck.php?character_id=' + charId + '&profile=1')
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d.ok) {
                    container.innerHTML = '<div class="rpg-deck-error">Error al cargar deck: ' + (d.error ? d.error.message : 'Error desconocido') + '</div>';
                    return;
                }

                var cards = d.data;
                if (cards.length === 0) {
                    container.innerHTML =
                        '<div class="rpg-deck-empty">' +
                            '<i class="fas fa-layer-group rpg-deck-empty__icon"></i>' +
                            '<h4>Deck Vacío</h4>' +
                            '<p class="rpg-deck-empty__text">Este personaje aún no tiene cartas asignadas.</p>' +
                        '</div>';
                    return;
                }

                var grouped = {};
                cards.forEach(function(c) {
                    if (!grouped[c.card_type]) grouped[c.card_type] = [];
                    grouped[c.card_type].push(c);
                });

                var typeNames = {
                    'tecnica': 'Técnicas', 'equipo': 'Equipamiento',
                    'haki': 'Haki', 'npc_menor': 'NPCs Menores', 'barco': 'Barcos'
                };
                var typeIcons = {
                    'tecnica':    '<i class="fas fa-fist-raised rpg-deck-icon--tecnica"></i>',
                    'equipo':     '<i class="fas fa-shield-alt rpg-deck-icon--equipo"></i>',

                    'haki':       '<i class="fas fa-fire rpg-deck-icon--haki"></i>',
                    'npc_menor':  '<i class="fas fa-users rpg-deck-icon--npc_menor"></i>',
                    'barco':      '<i class="fas fa-ship rpg-deck-icon--barco"></i>'
                };

                var html = '';
                for (var type in grouped) {
                    if (!Object.prototype.hasOwnProperty.call(grouped, type)) continue;
                    var list     = grouped[type];
                    var icon     = typeIcons[type] || '<i class="fas fa-layer-group"></i>';
                    var name     = typeNames[type]  || type.toUpperCase();
                    var secId    = 'rpg-deck-view-' + type;

                    html += '<div class="rpg-deck-section">' +
                        '<div class="rpg-deck-section-header" onclick="RpgCards.toggleDeckViewSection(\'' + secId + '\',this)">' +
                            '<div class="rpg-deck-section-title">' +
                                icon + ' ' + name + ' <span class="rpg-deck-section-count">(' + list.length + ')</span>' +
                            '</div>' +
                            '<div class="rpg-deck-section-arrow"><i class="fas fa-chevron-down"></i></div>' +
                        '</div>' +
                        '<div id="' + secId + '" class="rpg-deck-section-content">';

                    list.forEach(function(c) {
                        html += '<div class="rpg-card-wrapper">' +
                            self._qtyBadgeHtml(c) +
                            self.renderCard(c) +
                        '</div>';
                    });

                    html += '</div></div>';
                }

                container.innerHTML = html;
            })
            .catch(function() {
                container.innerHTML = '<div class="rpg-deck-error"><i class="fas fa-exclamation-triangle"></i> Error de conexión al cargar el deck.</div>';
            });
    },

    toggleDeckViewSection: function(sectionId, header) {
        var content = document.getElementById(sectionId);
        if (!content) return;
        var isOpen = content.classList.toggle('is-open');
        header.classList.toggle('is-open', isOpen);
    },

    requestDelete: function(charId, cardId, btn) {
        if (btn.disabled) return;
        btn.disabled = true;
        var originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';

        var self = this;
        fetch(this.config.baseUrl + '/game/ajax/cards_request_action.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ character_id: charId, card_id: cardId, action: 'delete' })
        })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.ok) {
                btn.innerHTML = '<i class="fas fa-clock"></i> Pendiente';
                btn.classList.add('is-pending');
                btn.onmouseover = null;
                btn.onmouseout  = null;
            } else {
                btn.disabled = false;
                btn.innerHTML = originalText;
                alert(res.error.message);
            }
        })
        .catch(function() {
            btn.disabled = false;
            btn.innerHTML = originalText;
            alert('Error de conexión.');
        });
    },

    // ──────────────────────────────────────────────────────────────────────────
    // CARTAS JUGADAS EN POST (colapsadas por defecto)
    // ──────────────────────────────────────────────────────────────────────────

    loadPostCards: function() {
        var self  = this;
        var zones = document.querySelectorAll('.rpg-post-cards-zone');
        self._postDebugLog('loadPostCards', { zones: zones.length });
        if (zones.length === 0) {
            self._postDebugLog('loadPostCards_skip', 'No .rpg-post-cards-zone en el DOM � �tema aplicado? Ejecuta php front/update_theme.php');
            return;
        }

        zones.forEach(function(zone) {
            self.renderSinglePostZone(zone);
        });
    },

    reloadPostCards: function(postId) {
        var zone = document.querySelector('.rpg-post-cards-zone[data-post-id="' + postId + '"]');
        if (zone) {
            this.renderSinglePostZone(zone);
        }
    },

    revealHiddenAction: function(postId, index, btn) {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';

        var self = this;
        var csrfToken = window.GAME_CSRF || '';
        fetch(this.config.baseUrl + '/game/ajax/reveal_hidden_action.php', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Mybb-Post-Key': csrfToken
            },
            body: JSON.stringify({ post_id: postId, index: index, my_post_key: csrfToken })
        })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.ok) {
                self.reloadPostCards(postId);
            } else {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-eye"></i> Mostrar Oculto ' + index;
                alert(res.error.message);
            }
        })
        .catch(function() {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-eye"></i> Mostrar Oculto ' + index;
            alert('Error de conexión.');
        });
    },

    renderSinglePostZone: function(zone) {
        var self = this;
        var postId = zone.dataset.postId;
        if (!postId) {
            self._postDebugLog('renderSinglePostZone_skip', 'zone sin data-post-id');
            return;
        }
        var url = self.config.baseUrl + '/game/ajax/cards_for_post.php?post_id=' + postId;
        if (self._postDebugEnabled()) {
            url += '&debug_post_rpg=1';
        }
        self._postDebugLog('fetch_cards_for_post', { postId: postId, url: url });
        fetch(url)
            .then(function(r) {
                if (!r.ok) {
                    throw new Error('HTTP ' + r.status);
                }
                return r.text();
            })
            .then(function(text) {
                try {
                    return JSON.parse(text);
                } catch (parseErr) {
                    self._postDebugLog('json_parse_error', { postId: postId, snippet: text.substring(0, 300) });
                    throw parseErr;
                }
            })
            .then(function(d) {
                if (!d.ok) {
                    self._postDebugLog('cards_for_post_not_ok', { postId: postId, error: d.error, debug: d._debug });
                    return;
                }

                self._postDebugLog('cards_for_post_ok', {
                    postId: postId,
                    cards: (d.data || []).length,
                    hidden: (d.hidden_actions || []).length,
                    oracles: (d.oracles || []).length,
                    mods: d.modifications,
                    debug: d._debug
                });

                var mods = d.modifications;
                var hasMods = false;
                if (mods) {
                    if (mods.pv_change !== 0 || mods.pe_change !== 0) {
                        hasMods = true;
                    }
                    if (mods.stat_mods) {
                        for (var key in mods.stat_mods) {
                            if (mods.stat_mods[key] !== 0) {
                                hasMods = true;
                                break;
                            }
                        }
                    }
                    if (mods.cooldown_mods && mods.cooldown_mods.length > 0) {
                        hasMods = true;
                    }
                }

                var hasNormalCards = d.data && d.data.length > 0;
                var hasHiddenActions = d.hidden_actions && d.hidden_actions.length > 0;
                var hasOracles = d.oracles && d.oracles.length > 0;
                var hasVoyage = !!(d.voyage && d.voyage.id);

                if (!hasNormalCards && !hasMods && !hasHiddenActions && !hasOracles && !hasVoyage) {
                    self._postDebugLog('zone_empty', { postId: postId });
                    zone.classList.remove('is-visible');
                    zone.innerHTML = '';
                    return;
                }

                zone.classList.add('is-visible');
                var html = '';
                var hasDice = false;

                if (hasMods) {
                    html += self.renderPostModifiersHtml(postId, mods);
                }

                // 2. Renderizar Cartas normales
                if (hasNormalCards) {
                    var bodyId   = 'rpg-pc-body-' + postId;
                    var arrowId  = 'rpg-pc-arrow-' + postId;
                    var toggleId = 'rpg-pc-toggle-' + postId;

                    html +=
                        '<div id="' + toggleId + '" class="rpg-post-cards-toggle" onclick="RpgCards.togglePostCards(\'' + bodyId + '\',\'' + arrowId + '\',\'' + toggleId + '\')">' +
                            '<span class="rpg-post-cards-toggle__label"><i class="fas fa-layer-group"></i> Cartas Jugadas (' + d.data.length + ')</span>' +
                            '<span id="' + arrowId + '" class="rpg-post-cards-toggle__arrow"><i class="fas fa-chevron-right"></i></span>' +
                        '</div>' +
                        '<div id="' + bodyId + '" class="rpg-post-cards-body">';

                    d.data.forEach(function(c) {
                        html += self.renderCard(c);
                        if (c.roll_result && c.roll_result.trim()) hasDice = true;
                    });
                    html += '</div>';
                }

                // 3. Renderizar Acciones Ocultas
                if (hasHiddenActions) {
                    d.hidden_actions.forEach(function(act) {
                        var idx = act.index;
                        var haBodyId   = 'rpg-ha-body-' + postId + '-' + idx;
                        var haArrowId  = 'rpg-ha-arrow-' + postId + '-' + idx;
                        var haToggleId = 'rpg-ha-toggle-' + postId + '-' + idx;
                        
                        var statusLabel = act.is_revealed 
                            ? ' <span class="rpg-hidden-badge-inline rpg-hidden-badge-inline--revealed"><i class="fas fa-eye"></i> Revelado</span>'
                            : ' <span class="rpg-hidden-badge-inline rpg-hidden-badge-inline--hidden"><i class="fas fa-eye-slash"></i> Oculto</span>';
                            
                        html +=
                            '<div id="' + haToggleId + '" class="rpg-post-cards-toggle" onclick="RpgCards.togglePostCards(\'' + haBodyId + '\',\'' + haArrowId + '\',\'' + haToggleId + '\')">' +
                                '<span class="rpg-post-cards-toggle__label"><i class="fas fa-eye-slash"></i> Acci�n Oculta #' + idx + statusLabel + '</span>' +
                                '<span id="' + haArrowId + '" class="rpg-post-cards-toggle__arrow"><i class="fas fa-chevron-right"></i></span>' +
                            '</div>' +
                            '<div id="' + haBodyId + '" class="rpg-post-hidden-action-body">';
                            
                        if (act.description) {
                            html += '<div class="rpg-hidden-desc">' + act.description.replace(/\n/g, '<br>') + '</div>';
                        }
                        
                        if (act.cards && act.cards.length > 0) {
                            html += '<div class="rpg-post-hidden-cards-grid">';
                            act.cards.forEach(function(c) {
                                html += self.renderCard(c);
                                if (c.roll_result && c.roll_result.trim()) hasDice = true;
                            });
                            html += '</div>';
                        }
                        
                        if (act.can_reveal && !act.is_revealed) {
                            html += '<div class="rpg-hidden-action-reveal-btn-wrap">' +
                                        '<button class="rpg-btn-reveal-hidden" onclick="RpgCards.revealHiddenAction(' + postId + ', ' + idx + ', this)">' +
                                            '<i class="fas fa-eye"></i> Mostrar Oculto ' + idx + 
                                        '</button>' +
                                    '</div>';
                        }
                        
                        html += '</div>';
                    });
                }

                if (hasOracles) {
                    html += self.renderPostOraclesHtml(postId, d.oracles);
                    hasDice = true;
                }

                if (hasVoyage) {
                    html += self.renderPostVoyageHtml(postId, d.voyage);
                    hasDice = true;
                }

                zone.innerHTML = html;
                self._postDebugLog('zone_rendered', {
                    postId: postId,
                    hasNormalCards: hasNormalCards,
                    hasMods: hasMods,
                    hasHiddenActions: hasHiddenActions,
                    hasOracles: hasOracles,
                    hasVoyage: hasVoyage
                });

                if (hasDice) {
                    var postWrapper = document.getElementById('post_' + postId);
                    if (postWrapper) {
                        var editBtn = postWrapper.querySelector('a[href*="editpost.php"]');
                        if (editBtn) {
                            editBtn.classList.add('is-edit-locked');
                            editBtn.title = 'No se puede editar: contiene tiradas de dados.';
                        }
                    }
                }
            })
            .catch(function(err) {
                self._postDebugLog('renderSinglePostZone_error', { postId: postId, message: String(err) });
            });
    },

    renderPostModifiersHtml: function(postId, mods) {
        var bodyId = 'rpg-mods-body-' + postId;
        var arrowId = 'rpg-mods-arrow-' + postId;
        var toggleId = 'rpg-mods-toggle-' + postId;
        var chips = '';
        var chipCount = 0;
        var statLabels = {
            'fue': 'FUE', 'res': 'RES', 'agi': 'AGI', 'des': 'DES',
            'int': 'INT', 'esp': 'ESP', 'inst': 'INST'
        };

        if (mods.pv_change > 0) {
            chips += '<span class="rpg-post-mod-chip rpg-post-mod-chip--hp-heal"><i class="fas fa-heart"></i> +' + mods.pv_change + ' PV</span>';
            chipCount++;
        } else if (mods.pv_change < 0) {
            chips += '<span class="rpg-post-mod-chip rpg-post-mod-chip--hp-damage"><i class="fas fa-heart-broken"></i> ' + mods.pv_change + ' PV</span>';
            chipCount++;
        }
        if (mods.pe_change > 0) {
            chips += '<span class="rpg-post-mod-chip rpg-post-mod-chip--pe-gain"><i class="fas fa-bolt"></i> +' + mods.pe_change + ' PE</span>';
            chipCount++;
        } else if (mods.pe_change < 0) {
            chips += '<span class="rpg-post-mod-chip rpg-post-mod-chip--pe-spend"><i class="fas fa-bolt"></i> ' + mods.pe_change + ' PE</span>';
            chipCount++;
        }
        if (mods.stat_mods) {
            for (var statKey in mods.stat_mods) {
                var val = parseInt(mods.stat_mods[statKey], 10);
                if (val !== 0) {
                    var statLabel = statLabels[statKey] || statKey.toUpperCase();
                    var resultLabel = (typeof RpgStats !== 'undefined' && RpgStats._rankLabel)
                        ? RpgStats._rankLabel((parseInt((RpgStats._baseRanks || {})[statKey], 10) || 1) + val)
                        : (val > 0 ? '+' + val : String(val));
                    if (val > 0) {
                        chips += '<span class="rpg-post-mod-chip rpg-post-mod-chip--stat-buff"><i class="fas fa-arrow-up"></i> ' + statLabel + ' ➔ ' + resultLabel + '</span>';
                    } else {
                        chips += '<span class="rpg-post-mod-chip rpg-post-mod-chip--stat-debuff"><i class="fas fa-arrow-down"></i> ' + statLabel + ' ➔ ' + resultLabel + '</span>';
                    }
                    chipCount++;
                }
            }
        }

        if (mods.cooldown_mods && Array.isArray(mods.cooldown_mods)) {
            mods.cooldown_mods.forEach(function(cd) {
                var remaining = parseInt(cd.remaining, 10);
                if (remaining === 0) {
                    chips += '<span class="rpg-post-mod-chip rpg-post-mod-chip--cd-removed"><i class="fas fa-hourglass-end"></i> CD: ' + cd.name + ' ➔ Quitado</span>';
                } else {
                    chips += '<span class="rpg-post-mod-chip rpg-post-mod-chip--cd-modified"><i class="fas fa-hourglass-half"></i> CD: ' + cd.name + ' ➔ ' + remaining + 't</span>';
                }
                chipCount++;
            });
        }

        return '<div id="' + toggleId + '" class="rpg-post-cards-toggle" onclick="RpgCards.togglePostCards(\'' + bodyId + '\',\'' + arrowId + '\',\'' + toggleId + '\')">' +
            '<span class="rpg-post-cards-toggle__label"><i class="fas fa-sliders-h"></i> Modificaciones (' + chipCount + ')</span>' +
            '<span id="' + arrowId + '" class="rpg-post-cards-toggle__arrow"><i class="fas fa-chevron-right"></i></span>' +
        '</div>' +
        '<div id="' + bodyId + '" class="rpg-post-mods-body">' +
            '<div class="rpg-post-mods-container">' + chips + '</div>' +
        '</div>';
    },

    renderPostOraclesHtml: function(postId, oracles) {
        var bodyId = 'rpg-oracles-body-' + postId;
        var arrowId = 'rpg-oracles-arrow-' + postId;
        var toggleId = 'rpg-oracles-toggle-' + postId;
        var hasAutoInvoked = oracles.some(function(o) { return o.auto_invoked; });
        var html =
            '<div id="' + toggleId + '" class="rpg-post-cards-toggle" onclick="RpgCards.togglePostCards(\'' + bodyId + '\',\'' + arrowId + '\',\'' + toggleId + '\')">' +
                '<span class="rpg-post-cards-toggle__label"><i class="fas fa-crystal-ball"></i> Or�culos (' + oracles.length + ')' +
                    (hasAutoInvoked ? ' <span class="rpg-oracle-invoked-badge"><i class="fas fa-link"></i> con auto-invocados</span>' : '') +
                '</span>' +
                '<span id="' + arrowId + '" class="rpg-post-cards-toggle__arrow"><i class="fas fa-chevron-right"></i></span>' +
            '</div>' +
            '<div id="' + bodyId + '" class="rpg-post-cards-body">';

        oracles.forEach(function(o) {
            var aiLabel = o.auto_invoked
                ? '<span class="rpg-oracle-auto-badge"><i class="fas fa-link"></i> Auto-invocado</span>'
                : '';
            html +=
                '<div class="rpg-oracle-card" data-oracle-id="' + o.oracle_id + '" data-post-oracle-id="' + o.id + '">' +
                    '<div class="rpg-oracle-card-header">' +
                        '<div class="rpg-oracle-card-title">' +
                            o.name +
                            (o.subtype ? ' <span class="rpg-oracle-subtype">' + o.subtype + '</span>' : '') +
                        '</div>' +
                        '<div class="rpg-oracle-card-dice">' +
                            aiLabel +
                            ' <span class="rpg-oracle-roll-badge"><i class="fas fa-dice-d6"></i> ' + (o.dice_type || 'd100') + ' ? <strong>' + o.roll_value + '</strong></span>' +
                        '</div>' +
                    '</div>' +
                    (o.description ? '<div class="rpg-oracle-card-desc">' + o.description + '</div>' : '') +
                    '<div class="rpg-oracle-card-result">' +
                        '<div class="rpg-oracle-result-range">Rango <strong>' + o.result_range + '</strong></div>' +
                        '<div class="rpg-oracle-result-text">' + o.result_text + '</div>' +
                        (o.result_description ? '<div class="rpg-oracle-result-desc">' + o.result_description + '</div>' : '') +
                    '</div>' +
                '</div>';
        });

        html += '</div>';
        return html;
    },

    _escapeVoyageText: function(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _seaZoneLabel: function(zone) {
        var labels = {
            east_blue: 'East Blue', west_blue: 'West Blue', north_blue: 'North Blue', south_blue: 'South Blue',
            grand_line: 'Grand Line', new_world: 'New World', calm_belt: 'Calm Belt', florian_triangle: 'Triángulo de Florian'
        };
        return labels[zone] || zone || '';
    },

    renderPostVoyageHtml: function(postId, voyage) {
        if (!voyage) return '';
        var bodyId = 'rpg-nav-body-' + postId;
        var arrowId = 'rpg-nav-arrow-' + postId;
        var toggleId = 'rpg-nav-toggle-' + postId;
        var fromName = (voyage.island_from && voyage.island_from.name) || '—';
        var toName = (voyage.island_to && voyage.island_to.name) || '—';
        var eventCount = voyage.events ? voyage.events.length : 0;

        return '<div id="' + toggleId + '" class="rpg-post-cards-toggle is-open" onclick="RpgCards.togglePostCards(\'' + bodyId + '\',\'' + arrowId + '\',\'' + toggleId + '\')">' +
            '<span class="rpg-post-cards-toggle__label">' +
                '<i class="fas fa-ship"></i> Navegación (' + eventCount + ' evento' + (eventCount !== 1 ? 's' : '') + ')' +
                ' <span class="rpg-nav-post-route">' + this._escapeVoyageText(fromName) + ' → ' + this._escapeVoyageText(toName) + '</span>' +
            '</span>' +
            '<span id="' + arrowId + '" class="rpg-post-cards-toggle__arrow"><i class="fas fa-chevron-right"></i></span>' +
        '</div>' +
        '<div id="' + bodyId + '" class="rpg-post-cards-body rpg-post-nav-voyage-body is-open">' +
            this.renderVoyagePanel(voyage) +
        '</div>';
    },

    renderVoyageEventCard: function(ev, index, isChild) {
        var self = this;
        var dice = ev.dice_type || 'd20';
        var invoked = ev.invoked || [];
        var childHtml = '';
        if (invoked.length) {
            childHtml = '<div class="rpg-nav-invoked-list">';
            invoked.forEach(function(child) {
                childHtml += self.renderVoyageEventCard(child, 0, true);
            });
            childHtml += '</div>';
        }
        var cardClass = 'rpg-oracle-card rpg-nav-event-card' + (isChild ? ' rpg-nav-event-card--child' : '');
        return '<div class="' + cardClass + '">' +
            '<div class="rpg-oracle-card-header">' +
                '<div class="rpg-oracle-card-title">' +
                    (isChild ? '' : '<span class="rpg-nav-event-num">#' + index + '</span> ') +
                    self._escapeVoyageText(ev.oracle_name || 'Evento') +
                    (ev.subtype ? ' <span class="rpg-oracle-subtype">' + self._escapeVoyageText(ev.subtype) + '</span>' : '') +
                '</div>' +
                '<div class="rpg-oracle-card-dice">' +
                    (isChild ? '<span class="rpg-oracle-auto-badge"><i class="fas fa-link"></i> Auto</span> ' : '') +
                    '<span class="rpg-oracle-roll-badge"><i class="fas fa-dice-d6"></i> ' + dice + ' → <strong>' + self._escapeVoyageText(ev.roll_value) + '</strong></span>' +
                '</div>' +
            '</div>' +
            '<div class="rpg-oracle-card-result rpg-nav-event-result-box">' +
                '<div class="rpg-oracle-result-range">Rango <strong>' + self._escapeVoyageText(ev.result_range || '—') + '</strong></div>' +
                '<div class="rpg-oracle-result-text">' + self._escapeVoyageText(ev.result_text) + '</div>' +
                (ev.result_description ? '<div class="rpg-oracle-result-desc">' + self._escapeVoyageText(ev.result_description) + '</div>' : '') +
            '</div>' +
            childHtml +
        '</div>';
    },

    renderVoyagePanel: function(voyage) {
        if (!voyage) return '';
        var self = this;
        var dangerLabels = ['', 'Tranquilo', 'Moderado', 'Peligroso', 'Muy peligroso', 'EXTREMO'];
        var instrumentLabels = { none: 'Sin instrumento', compass: 'Brújula', log_pose: 'Log Pose', eternal_pose: 'Eternal Pose' };
        var statusLabels = { active: 'En travesía', arrived: 'Llegó', cancelled: 'Cancelado' };
        var reviewLabels = { pending: 'Revisión pendiente', approved: 'Aprobado', denied: 'Denegado' };
        var dangerLvl = parseInt(voyage.danger_level, 10) || 1;
        var from = voyage.island_from || {};
        var to = voyage.island_to || {};
        var ship = voyage.ship || {};
        var eventsHtml = '';

        if (voyage.events && voyage.events.length) {
            voyage.events.forEach(function(ev, i) {
                eventsHtml += self.renderVoyageEventCard(ev, i + 1, false);
            });
        } else {
            eventsHtml = '<p class="rpg-nav-no-events"><i class="fas fa-water"></i> Mar en calma — sin eventos en esta travesía.</p>';
        }

        var numEvents = parseInt(voyage.num_events, 10);
        if (isNaN(numEvents)) {
            numEvents = voyage.events ? voyage.events.length : 0;
        }
        var durationDays = parseInt(voyage.duration_days, 10) || 0;
        var fromName = self._escapeVoyageText(from.name || '—');
        var toName = self._escapeVoyageText(to.name || '—');
        var dangerText = dangerLvl + ' — ' + (dangerLabels[dangerLvl] || '');

        var summaryHtml =
            '<dl class="rpg-nav-summary">' +
                '<div class="rpg-nav-summary-row rpg-nav-summary-row--route">' +
                    '<dt>Ruta</dt>' +
                    '<dd><span class="rpg-nav-summary-route">' + fromName + ' <i class="fas fa-long-arrow-alt-right"></i> ' + toName + '</span></dd>' +
                '</div>' +
                '<div class="rpg-nav-summary-row">' +
                    '<dt>Peligro</dt>' +
                    '<dd><span class="rpg-nav-summary-danger rpg-nav-summary-danger--' + dangerLvl + '">' + dangerText + '</span></dd>' +
                '</div>' +
                '<div class="rpg-nav-summary-row">' +
                    '<dt>Nº de eventos</dt>' +
                    '<dd>' + numEvents + '</dd>' +
                '</div>' +
                '<div class="rpg-nav-summary-row">' +
                    '<dt>Días de navegación</dt>' +
                    '<dd>' + durationDays + '</dd>' +
                '</div>' +
            '</dl>';

        var metaChips =
            '<span class="rpg-nav-meta-chip"><i class="fas fa-ruler"></i> ' + (voyage.distance || 0) + ' leguas</span>';

        if (voyage.instrument && voyage.instrument !== 'none') {
            metaChips += '<span class="rpg-nav-meta-chip"><i class="fas fa-compass"></i> ' + (instrumentLabels[voyage.instrument] || voyage.instrument) + '</span>';
        }
        if (voyage.navigator_bonus > 0) {
            metaChips += '<span class="rpg-nav-meta-chip"><i class="fas fa-user-ninja"></i> Navegante G.' + voyage.navigator_bonus + '</span>';
        }

        var statusHtml = '<span class="rpg-nav-status rpg-nav-status--' + self._escapeVoyageText(voyage.status) + '">' +
            (statusLabels[voyage.status] || voyage.status) + '</span>';
        if (voyage.staff_review && reviewLabels[voyage.staff_review]) {
            statusHtml += '<span class="rpg-nav-review rpg-nav-review--' + self._escapeVoyageText(voyage.staff_review) + '">' +
                reviewLabels[voyage.staff_review] + '</span>';
        }

        var rolHtml = '';
        if (voyage.expected_end_rol_label) {
            rolHtml = '<div class="rpg-nav-rol-line"><i class="fas fa-calendar-alt"></i> Llegada prevista: <strong>' +
                self._escapeVoyageText(voyage.expected_end_rol_label) + '</strong>' +
                (voyage.start_rol_label ? ' <span class="rpg-nav-rol-sub">(salida: ' + self._escapeVoyageText(voyage.start_rol_label) + ')</span>' : '') +
                '</div>';
        }

        return '<div class="rpg-voyage-panel">' +
            '<div class="rpg-voyage-top">' + statusHtml + rolHtml + '</div>' +
            summaryHtml +
            '<div class="rpg-voyage-route-card">' +
                '<div class="rpg-voyage-stop">' +
                    '<div class="rpg-voyage-stop-label">Origen</div>' +
                    '<div class="rpg-voyage-stop-name">' + self._escapeVoyageText(from.name || '—') + '</div>' +
                    '<div class="rpg-voyage-stop-zone">' + self._escapeVoyageText(self._seaZoneLabel(from.sea_zone)) + '</div>' +
                '</div>' +
                '<div class="rpg-voyage-mid">' +
                    '<div class="rpg-voyage-ship-line"><i class="fas fa-ship"></i></div>' +
                    '<div class="rpg-voyage-ship-name">' + self._escapeVoyageText(ship.name || '—') + '</div>' +
                '</div>' +
                '<div class="rpg-voyage-stop rpg-voyage-stop--dest">' +
                    '<div class="rpg-voyage-stop-label">Destino</div>' +
                    '<div class="rpg-voyage-stop-name">' + self._escapeVoyageText(to.name || '—') + '</div>' +
                    '<div class="rpg-voyage-stop-zone">' + self._escapeVoyageText(self._seaZoneLabel(to.sea_zone)) + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="rpg-nav-meta-row">' + metaChips + '</div>' +
            '<div class="rpg-voyage-events-block">' +
                '<div class="rpg-voyage-events-heading"><i class="fas fa-dice"></i> Eventos de travesía</div>' +
                eventsHtml +
            '</div>' +
        '</div>';
    },

    togglePostCards: function(bodyId, arrowId, toggleId) {
        var body  = document.getElementById(bodyId);
        var arrow = document.getElementById(arrowId);
        var toggle = toggleId ? document.getElementById(toggleId) : null;
        if (!body) return;
        var isOpen = body.classList.toggle('is-open');
        if (arrow) arrow.classList.toggle('is-open', isOpen);
        if (toggle) toggle.classList.toggle('is-open', isOpen);
    },

    // ──────────────────────────────────────────────────────────────────────────
    // ATTACHMENTS (armas / munición / acción mascota)
    // ──────────────────────────────────────────────────────────────────────────

    buildAttachmentsHtml: function(c, weapons, ammo) {
        if (c.card_type === 'npc_menor') {
            var effects  = c.effects || {};
            var npcType  = (effects.npc_mascota_type || 'npc').toLowerCase();
            if (npcType === 'mascota') {
                var rawActions  = effects.acciones || [];
                var actionsList = typeof rawActions === 'string'
                    ? rawActions.split('\n').map(function(a){ return a.trim(); }).filter(Boolean)
                    : rawActions;

                if (actionsList && actionsList.length > 0) {
                    var html = '<div class="rpg-attachment-field">' +
                        '<label class="rpg-attachment-label">Acci�n de la Mascota</label>' +
                        '<select class="rpg-attachment-action textbox rpg-attachment-select">' +
                            '<option value="">-- Selecciona una acción --</option>';
                    actionsList.forEach(function(act) {
                        html += '<option value="' + act + '">' + act + '</option>';
                    });
                    html += '</select></div>';
                    return html;
                }
            }
        }

        if (!c.dice) return '';
        var armMatches  = c.dice.match(/\[ARMA\]/g);
        var armCount    = armMatches  ? armMatches.length  : 0;
        var muniMatches = c.dice.match(/\[MUNICION\]/g);
        var muniCount   = muniMatches ? muniMatches.length : 0;

        if (armCount === 0 && muniCount === 0) return '';

        var html = '';

        for (var i = 0; i < armCount; i++) {
            html += '<div class="rpg-attachment-field">' +
                '<label class="rpg-attachment-label">Arma #' + (i + 1) + '</label>' +
                '<select class="rpg-attachment-weapon textbox rpg-attachment-select" data-index="' + i + '">' +
                    '<option value="">-- Ninguna --</option>';
            weapons.forEach(function(w) {
                html += '<option value="' + w.id + '">' + w.name + ' (' + (w.dice || 'Sin dados') + ')</option>';
            });
            html += '</select></div>';
        }

        for (var j = 0; j < muniCount; j++) {
            html += '<div class="rpg-attachment-field">' +
                '<label class="rpg-attachment-label">Munición #' + (j + 1) + '</label>' +
                '<select class="rpg-attachment-ammo textbox rpg-attachment-select" data-index="' + j + '">' +
                    '<option value="">-- Ninguna --</option>';
            ammo.forEach(function(a) {
                html += '<option value="' + a.id + '">' + a.name + ' (' + (a.dice || 'Sin dados') + ')</option>';
            });
            html += '</select></div>';
        }

        return html;
    },

    _normalizeFormula: function(formula) {
        return String(formula || '').replace(/\s+/g, '').toLowerCase();
    },

    _emptyRollMods: function(baseFormula) {
        var base = (baseFormula || '').trim();
        return { baseFormula: base, formula: base };
    },

    _ensureRollModifiers: function(cid, baseFormula) {
        if (!this._rollModifiers[cid]) {
            this._rollModifiers[cid] = this._emptyRollMods(baseFormula || '');
        } else if (baseFormula && !this._rollModifiers[cid].baseFormula) {
            this._rollModifiers[cid].baseFormula = baseFormula.trim();
            if (!this._rollModifiers[cid].formula) {
                this._rollModifiers[cid].formula = this._rollModifiers[cid].baseFormula;
            }
        }
        return this._rollModifiers[cid];
    },

    _rollModIsChanged: function(cid) {
        var mods = this._rollModifiers[cid];
        if (!mods) return false;
        return this._normalizeFormula(mods.formula) !== this._normalizeFormula(mods.baseFormula);
    },

    _rollModSummaryText: function(cid) {
        var mods = this._rollModifiers[cid];
        if (!mods || !this._rollModIsChanged(cid)) return '';
        return (mods.formula || '').trim();
    },

    _hasRollMods: function(cid) {
        return this._rollModIsChanged(cid);
    },

    _updateRollOptionSummary: function(cid) {
        var summary = this._rollModSummaryText(cid);
        var el = document.querySelector('.rpg-roll-mod-summary[data-cid="' + cid + '"]');
        if (!el) return;
        if (summary) {
            el.innerHTML = '<i class="fas fa-pen"></i> F\u00f3rmula: <strong>' + this._escapeHtml(summary) + '</strong>';
            el.classList.add('is-visible');
        } else {
            el.innerHTML = '';
            el.classList.remove('is-visible');
        }
    },

    _escapeHtml: function(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    buildRollOptionsHtml: function(c) {
        if (!c.dice || c.dice.trim() === '' || c.dice.trim() === '\u2014') return '';
        if (c.card_type === 'npc_menor' || c.card_type === 'barco') return '';
        var cid = this._cardIdInt(c.id);
        var summary = this._rollModSummaryText(cid);
        var summaryHtml = summary
            ? '<div class="rpg-roll-mod-summary is-visible" data-cid="' + cid + '"><i class="fas fa-pen"></i> F\u00f3rmula: <strong>' + this._escapeHtml(summary) + '</strong></div>'
            : '<div class="rpg-roll-mod-summary" data-cid="' + cid + '"></div>';
        return '<div class="rpg-attachment-field rpg-roll-option-field" data-cid="' + cid + '">' +
            '<label class="rpg-attachment-label">Opciones de tirada</label>' +
            '<select class="rpg-card-roll-action textbox rpg-attachment-select" data-cid="' + cid + '" data-base-dice="' + (c.dice || '').replace(/"/g, '&quot;') + '">' +
                '<option value="">Tirada normal</option>' +
                '<option value="modify">Editar f\u00f3rmula\u2026</option>' +
            '</select>' +
            summaryHtml +
        '</div>';
    },

    _rollModModalCid: 0,
    _rollModModalBase: '',
    _rollModModalBound: false,
    _rollModSyncLock: false,

    _rollModBuildFromBuilder: function() {
        var modal = document.getElementById('rpg-roll-modifier-modal');
        if (!modal) return '';
        var parts = [];
        modal.querySelectorAll('#rpg-roll-mod-groups .rpg-roll-mod-dice-group').forEach(function(g) {
            var qty = parseInt(g.querySelector('.rpg-roll-mod-qty').value, 10) || 0;
            var type = g.querySelector('.rpg-roll-mod-type').value;
            if (qty > 0 && type) parts.push(qty + type);
        });
        modal.querySelectorAll('#rpg-roll-mod-groups .rpg-roll-mod-placeholder').forEach(function(g) {
            parts.push(g.dataset.placeholder || '');
        });
        var fixed = parseInt((document.getElementById('rpg-roll-mod-fixed') || {}).value || '0', 10) || 0;
        var stat = (document.getElementById('rpg-roll-mod-stat') || {}).value || '';
        var statMod = (document.getElementById('rpg-roll-mod-stat-mod') || {}).value.trim();
        var suffix = (document.getElementById('rpg-roll-mod-suffix') || {}).value.trim();
        var formula = parts.join('+');
        if (fixed !== 0) formula += (formula ? '+' : '') + fixed;
        if (stat) {
            var statPart = stat;
            if (statMod) {
                if (statMod.indexOf('/') === 0) {
                    statPart = stat + statMod;
                } else if (statMod.indexOf('*') >= 0) {
                    var mult = statMod.replace('*', '').trim();
                    statPart = mult + '*' + stat;
                } else if (!isNaN(parseFloat(statMod))) {
                    statPart = statMod + '*' + stat;
                } else {
                    statPart = statMod + stat;
                }
            }
            formula += (formula ? '+' : '') + statPart;
        }
        if (suffix) formula += (formula ? ' ' : '') + suffix;
        return formula.trim();
    },

    _rollModSyncPreview: function() {
        if (this._rollModSyncLock) return;
        var formula = this._rollModBuildFromBuilder();
        var preview = document.getElementById('rpg-roll-mod-preview-text');
        var textInput = document.getElementById('rpg-roll-mod-formula-text');
        if (preview) preview.textContent = formula || '\u2014';
        if (textInput && document.activeElement !== textInput) {
            this._rollModSyncLock = true;
            textInput.value = formula;
            this._rollModSyncLock = false;
        }
    },

    _rollModAddDiceGroup: function(qty, type) {
        var container = document.getElementById('rpg-roll-mod-groups');
        if (!container) return;
        var self = this;
        var group = document.createElement('div');
        group.className = 'rpg-roll-mod-dice-group rpg-dice-group-chip';
        group.innerHTML =
            '<input type="number" class="textbox rpg-roll-mod-qty" min="0" max="99" value="' + (qty || 1) + '">' +
            '<select class="textbox rpg-roll-mod-type">' +
                ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].map(function(d) {
                    return '<option value="' + d + '"' + (d === (type || 'd20') ? ' selected' : '') + '>' + d + '</option>';
                }).join('') +
            '</select>' +
            '<button type="button" class="rpg-roll-mod-remove" title="Quitar">&times;</button>';
        group.querySelector('.rpg-roll-mod-remove').addEventListener('click', function() {
            group.remove();
            self._rollModSyncPreview();
        });
        group.querySelectorAll('input, select').forEach(function(el) {
            el.addEventListener('input', function() { self._rollModSyncPreview(); });
            el.addEventListener('change', function() { self._rollModSyncPreview(); });
        });
        container.appendChild(group);
        this._rollModSyncPreview();
    },

    _rollModAddPlaceholder: function(type) {
        var container = document.getElementById('rpg-roll-mod-groups');
        if (!container) return;
        var self = this;
        var group = document.createElement('div');
        group.className = 'rpg-roll-mod-placeholder rpg-dice-group-chip rpg-dice-group-chip--placeholder';
        group.dataset.placeholder = type;
        group.innerHTML =
            '<span class="rpg-roll-mod-placeholder-label">' + type + '</span>' +
            '<button type="button" class="rpg-roll-mod-remove" title="Quitar">&times;</button>';
        group.querySelector('.rpg-roll-mod-remove').addEventListener('click', function() {
            group.remove();
            self._rollModSyncPreview();
        });
        container.appendChild(group);
        this._rollModSyncPreview();
    },

    _rollModLoadIntoBuilder: function(formula) {
        var container = document.getElementById('rpg-roll-mod-groups');
        if (!container) return;
        container.innerHTML = '';
        var fixedEl = document.getElementById('rpg-roll-mod-fixed');
        var statEl = document.getElementById('rpg-roll-mod-stat');
        var statModEl = document.getElementById('rpg-roll-mod-stat-mod');
        var suffixEl = document.getElementById('rpg-roll-mod-suffix');
        if (fixedEl) fixedEl.value = '0';
        if (statEl) statEl.value = '';
        if (statModEl) statModEl.value = '';
        if (suffixEl) suffixEl.value = '';

        if (!formula || formula === '\u2014' || !formula.trim()) {
            this._rollModSyncPreview();
            return;
        }

        var suffix = '';
        var formulaNoSuffix = formula.trim();
        var suffixMatch = formula.match(/\[([^\]]+)\]$/);
        if (suffixMatch) {
            suffix = suffixMatch[0];
            formulaNoSuffix = formula.substring(0, formula.length - suffix.length).trim();
        }

        var self = this;
        formulaNoSuffix.split('+').forEach(function(part) {
            part = part.trim();
            if (!part) return;
            var diceMatch = part.match(/^(\d+)(d\d+)$/i);
            if (diceMatch) {
                self._rollModAddDiceGroup(parseInt(diceMatch[1], 10), diceMatch[2].toLowerCase());
                return;
            }
            if (part === '[ARMA]' || part === '[MUNICION]') {
                self._rollModAddPlaceholder(part);
                return;
            }
            var multMatch = part.match(/^([\d.]+)\*(FUE|AGI|DES|INST|ESP|INT)$/i);
            if (multMatch && statEl && statModEl) {
                statEl.value = multMatch[2].toUpperCase();
                statModEl.value = multMatch[1] + '*';
                return;
            }
            var divMatch = part.match(/^(FUE|AGI|DES|INST|ESP|INT)\/([\d.]+)$/i);
            if (divMatch && statEl && statModEl) {
                statEl.value = divMatch[1].toUpperCase();
                statModEl.value = '/' + divMatch[2];
                return;
            }
            if (['FUE', 'AGI', 'DES', 'INST', 'ESP', 'INT'].indexOf(part.toUpperCase()) !== -1 && statEl) {
                statEl.value = part.toUpperCase();
                return;
            }
            if (/^-?\d+$/.test(part) && fixedEl) {
                fixedEl.value = part;
                return;
            }
        });
        if (suffix && suffixEl) suffixEl.value = suffix;
        this._rollModSyncPreview();
    },

    _ensureRollModifierModal: function() {
        var existing = document.getElementById('rpg-roll-modifier-modal');
        if (existing && existing.dataset.version === '3') return;
        if (existing) existing.remove();
        this._rollModModalBound = false;

        var statOpts = ['', 'FUE', 'AGI', 'DES', 'INST', 'ESP', 'INT'].map(function(s) {
            return '<option value="' + s + '">' + (s || '\u2014 Stat \u2014') + '</option>';
        }).join('');

        var html =
            '<div id="rpg-roll-modifier-modal" class="rpg-modal-overlay" data-version="3" aria-hidden="true">' +
                '<div class="rpg-modal-panel rpg-roll-mod-modal" role="dialog">' +
                    '<div class="rpg-roll-mod-modal__hero">' +
                        '<div class="rpg-roll-mod-modal__icon"><i class="fas fa-dice-d20"></i></div>' +
                        '<div class="rpg-roll-mod-modal__intro">' +
                            '<span class="rpg-roll-mod-modal__eyebrow">Editor de f\u00f3rmula</span>' +
                            '<h3 class="rpg-roll-mod-modal__title" id="rpg-roll-mod-card-name">Modificar tirada</h3>' +
                            '<p class="rpg-roll-mod-modal__original">Original: <code id="rpg-roll-mod-base-ref">\u2014</code></p>' +
                        '</div>' +
                        '<button type="button" class="rpg-modal-close rpg-roll-mod-modal__close" data-rpg-roll-mod-close aria-label="Cerrar">&times;</button>' +
                    '</div>' +
                    '<div class="rpg-modal-body rpg-roll-mod-modal__body">' +
                        '<div class="rpg-roll-mod-formula-display">' +
                            '<span class="rpg-roll-mod-formula-display__label">F\u00f3rmula resultante</span>' +
                            '<code id="rpg-roll-mod-preview-text" class="rpg-roll-mod-formula-display__value">\u2014</code>' +
                        '</div>' +
                        '<div class="rpg-roll-mod-section">' +
                            '<h4 class="rpg-roll-mod-section-title">Componentes</h4>' +
                            '<div id="rpg-roll-mod-groups" class="rpg-roll-mod-groups"></div>' +
                            '<div class="rpg-roll-mod-toolbar">' +
                                '<button type="button" class="rpg-system-tab-btn" data-roll-add="dice"><i class="fas fa-plus"></i> Dados</button>' +
                                '<button type="button" class="rpg-system-tab-btn" data-roll-add="arma"><i class="fas fa-sword"></i> [ARMA]</button>' +
                                '<button type="button" class="rpg-system-tab-btn" data-roll-add="municion"><i class="fas fa-bullseye"></i> [MUNICION]</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="rpg-roll-mod-meta-grid">' +
                            '<div class="rpg-roll-mod-meta-item">' +
                                '<label class="rpg-form-label" for="rpg-roll-mod-fixed">Valor fijo</label>' +
                                '<input type="number" id="rpg-roll-mod-fixed" class="textbox" value="0" step="1">' +
                            '</div>' +
                            '<div class="rpg-roll-mod-meta-item">' +
                                '<label class="rpg-form-label" for="rpg-roll-mod-stat">Stat</label>' +
                                '<select id="rpg-roll-mod-stat" class="textbox">' + statOpts + '</select>' +
                            '</div>' +
                            '<div class="rpg-roll-mod-meta-item">' +
                                '<label class="rpg-form-label" for="rpg-roll-mod-stat-mod">Mod. stat</label>' +
                                '<input type="text" id="rpg-roll-mod-stat-mod" class="textbox" placeholder="ej. 2* o /2">' +
                            '</div>' +
                            '<div class="rpg-roll-mod-meta-item rpg-roll-mod-meta-item--wide">' +
                                '<label class="rpg-form-label" for="rpg-roll-mod-suffix">Etiqueta / sufijo</label>' +
                                '<input type="text" id="rpg-roll-mod-suffix" class="textbox" placeholder="ej. [FUEGO]">' +
                            '</div>' +
                        '</div>' +
                        '<div class="rpg-roll-mod-section rpg-roll-mod-section--text">' +
                            '<label class="rpg-form-label" for="rpg-roll-mod-formula-text">Edici\u00f3n directa</label>' +
                            '<input type="text" id="rpg-roll-mod-formula-text" class="textbox rpg-roll-mod-formula-input" placeholder="2d20+FUE, 1d6+3, [ARMA]+[MUNICION]+agi\u2026">' +
                            '<p class="rpg-roll-mod-hint">Puedes escribir la f\u00f3rmula a mano o usar el editor visual. Quita todos los dados para anular la tirada base.</p>' +
                        '</div>' +
                    '</div>' +
                    '<div class="rpg-modal-footer rpg-roll-mod-modal__footer">' +
                        '<button type="button" class="rpg-system-tab-btn" id="rpg-roll-mod-reset">Restaurar original</button>' +
                        '<button type="button" class="rpg-system-tab-btn" data-rpg-roll-mod-close>Cancelar</button>' +
                        '<button type="button" class="rpg-system-tab-btn active" id="rpg-roll-mod-apply"><i class="fas fa-check"></i> Aplicar</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
        this._bindRollModifierModal();
    },

    _bindRollModifierModal: function() {
        if (this._rollModModalBound) return;
        this._rollModModalBound = true;
        var self = this;
        var modal = document.getElementById('rpg-roll-modifier-modal');
        if (!modal) return;

        function closeModal() {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('rpg-modal-open');
            self._rollModModalCid = 0;
        }

        modal.querySelectorAll('[data-rpg-roll-mod-close]').forEach(function(btn) {
            btn.addEventListener('click', closeModal);
        });
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
        });

        modal.querySelectorAll('[data-roll-add]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var kind = btn.getAttribute('data-roll-add');
                if (kind === 'dice') self._rollModAddDiceGroup(1, 'd6');
                if (kind === 'arma') self._rollModAddPlaceholder('[ARMA]');
                if (kind === 'municion') self._rollModAddPlaceholder('[MUNICION]');
            });
        });

        ['rpg-roll-mod-fixed', 'rpg-roll-mod-stat', 'rpg-roll-mod-stat-mod', 'rpg-roll-mod-suffix'].forEach(function(id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', function() { self._rollModSyncPreview(); });
            el.addEventListener('change', function() { self._rollModSyncPreview(); });
        });

        var textInput = document.getElementById('rpg-roll-mod-formula-text');
        if (textInput) {
            textInput.addEventListener('input', function() {
                if (self._rollModSyncLock) return;
                self._rollModSyncLock = true;
                self._rollModLoadIntoBuilder(textInput.value.trim());
                self._rollModSyncLock = false;
            });
        }

        document.getElementById('rpg-roll-mod-reset').addEventListener('click', function() {
            self._rollModLoadIntoBuilder(self._rollModModalBase || '');
        });

        document.getElementById('rpg-roll-mod-apply').addEventListener('click', function() {
            var cid = self._rollModModalCid;
            if (!cid) return;
            var textVal = (document.getElementById('rpg-roll-mod-formula-text') || {}).value.trim();
            var builtVal = self._rollModBuildFromBuilder();
            var formula = textVal || builtVal;
            var mods = self._ensureRollModifiers(cid, self._rollModModalBase);
            mods.baseFormula = self._rollModModalBase || mods.baseFormula;
            mods.formula = formula;
            self._updateRollOptionSummary(cid);
            self.updatePlayedCardsInput();
            closeModal();
        });
    },

    openRollModifierModal: function(cid, cardName, baseDice) {
        this._ensureRollModifierModal();
        var modal = document.getElementById('rpg-roll-modifier-modal');
        if (!modal) return;
        var base = (baseDice || '').trim();
        this._rollModModalCid = cid;
        this._rollModModalBase = base;
        var mods = this._ensureRollModifiers(cid, base);
        if (this._normalizeFormula(mods.baseFormula) !== this._normalizeFormula(base)) {
            mods.baseFormula = base;
            if (!this._rollModIsChanged(cid)) mods.formula = base;
        }
        var titleEl = document.getElementById('rpg-roll-mod-card-name');
        var baseRef = document.getElementById('rpg-roll-mod-base-ref');
        if (titleEl) titleEl.textContent = cardName || 'Modificar tirada';
        if (baseRef) baseRef.textContent = base || '\u2014';
        this._rollModLoadIntoBuilder(mods.formula || base);
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('rpg-modal-open');
    },

    // ──────────────────────────────────────────────────────────────────────────
    // PAYLOAD (cartas seleccionadas)
    // ──────────────────────────────────────────────────────────────────────────

    restorePlayedCardsFromJson: function(jsonStr) {
        if (!jsonStr) return;
        var payload;
        try { payload = JSON.parse(jsonStr); } catch (e) { return; }
        if (!Array.isArray(payload)) return;
        var self = this;
        payload.forEach(function(entry) {
            var cid = (typeof entry === 'object' && entry) ? parseInt(entry.card_id, 10) : parseInt(entry, 10);
            if (!cid) return;
            var el = document.querySelector('#rpg-card-deck-panel .rpg-selectable-card[data-cid="' + cid + '"]');
            if (!el || el.classList.contains('is-disabled')) return;
            el.classList.add('selected');
            if (self.selectedCards.indexOf(String(cid)) === -1) {
                self.selectedCards.push(String(cid));
            }
            var container = el.closest('.rpg-selectable-card-container');
            var attachmentsCt = container ? container.querySelector('.rpg-card-attachments') : null;
            if (attachmentsCt && typeof entry === 'object') {
                attachmentsCt.classList.add('is-visible');
                if (entry.weapons) {
                    var wSels = attachmentsCt.querySelectorAll('.rpg-attachment-weapon');
                    entry.weapons.forEach(function(wid, i) { if (wSels[i]) wSels[i].value = String(wid); });
                }
                if (entry.ammo) {
                    var aSels = attachmentsCt.querySelectorAll('.rpg-attachment-ammo');
                    entry.ammo.forEach(function(aid, i) { if (aSels[i]) aSels[i].value = String(aid); });
                }
                if (entry.selected_action) {
                    var actSel = attachmentsCt.querySelector('.rpg-attachment-action');
                    if (actSel) actSel.value = entry.selected_action;
                }
            }
            // Restaurar modificadores de tirada
            if (typeof entry === 'object' && entry.roll_modifiers) {
                var rmEntry = entry.roll_modifiers;
                var cardObj = self.deckData && self.deckData.find(function(c) { return self._cardIdInt(c.id) === cid; });
                var base = cardObj ? (cardObj.dice || '').trim() : '';
                var rm = self._ensureRollModifiers(cid, base);
                if (rmEntry.formula_override) {
                    rm.baseFormula = base;
                    rm.formula = String(rmEntry.formula_override).trim();
                } else {
                    var rebuilt = base;
                    if (rmEntry.dice_mod) {
                        rmEntry.dice_mod.forEach(function(d) {
                            if (d) rebuilt += '+' + d;
                        });
                    }
                    if (rmEntry.flat_mod !== undefined && rmEntry.flat_mod !== 0) {
                        var flat = parseInt(rmEntry.flat_mod, 10) || 0;
                        rebuilt += flat > 0 ? '+' + flat : String(flat);
                    }
                    rm.baseFormula = base;
                    rm.formula = rebuilt;
                }
                self._updateRollOptionSummary(cid);
            }
        });
        self.updatePlayedCardsInput();
        self.updatePaUsage();
    },

    updatePlayedCardsInput: function() {
        var input = document.getElementById('rpg_played_cards');
        if (!input) return;

        var payload     = [];
        var selectedEls = document.querySelectorAll('.rpg-selectable-card.selected');

        selectedEls.forEach(function(el) {
            var cid           = parseInt(el.dataset.cid);
            var container     = el.closest('.rpg-selectable-card-container');
            var attachmentsCt = container ? container.querySelector('.rpg-card-attachments') : null;

            var hasAttachments = attachmentsCt && attachmentsCt.classList.contains('is-visible');
            var hasRollMods = RpgCards._rollModIsChanged(cid);

            if (hasAttachments || hasRollMods) {
                var item = { card_id: cid };

                if (hasAttachments) {
                    var weaponSelects = attachmentsCt.querySelectorAll('.rpg-attachment-weapon');
                    var ammoSelects   = attachmentsCt.querySelectorAll('.rpg-attachment-ammo');
                    var actionSelect  = attachmentsCt.querySelector('.rpg-attachment-action');

                    var weapons = [];
                    weaponSelects.forEach(function(sel) { if (sel.value) weapons.push(parseInt(sel.value)); });

                    var ammo = [];
                    ammoSelects.forEach(function(sel) { if (sel.value) ammo.push(parseInt(sel.value)); });

                    if (weapons.length > 0) { item.weapons = weapons; }
                    if (ammo.length    > 0) { item.ammo    = ammo; }
                    if (actionSelect && actionSelect.value) { item.selected_action = actionSelect.value; }
                }

                if (hasRollMods) {
                    var mods = RpgCards._rollModifiers[cid];
                    item.roll_modifiers = {
                        formula_override: (mods.formula || '').trim()
                    };
                }

                payload.push(item);
            } else {
                payload.push(cid);
            }
        });

        input.value = JSON.stringify(payload);
    },

    getCardExecutionCost: function(cid) {
        if (!RpgCards.deckData) return 0;
        var card = RpgCards.deckData.find(function(c) { return c.id === parseInt(cid); });
        return card ? parseInt(card.execution_cost || 0) : 0;
    },

    updatePaUsage: function() {
        var maxPa = RpgStats._maxPa || 10;
        var remainingPa = maxPa;
        
        var displayEl = document.getElementById('rpg-stat-pa-display');
        var inputEl = document.getElementById('rpg-stat-pa-input');
        if (displayEl) displayEl.textContent = remainingPa;
        if (inputEl) inputEl.value = remainingPa;
        
        document.querySelectorAll('.rpg-pa-current-val').forEach(function(el) {
            el.textContent = remainingPa;
        });

    },

    initCardSelector: function() {
        var selector  = document.getElementById('rpg-card-selector');
        var toggleBtn = document.getElementById('rpg-card-toggle-btn');
        var panel     = document.getElementById('rpg-card-deck-panel');
        var input     = document.getElementById('rpg_played_cards');

        if (!selector || !toggleBtn || !panel || !input) return;

        var self = this;
        var tidInput = document.querySelector('input[name="tid"]');
        var tid      = tidInput ? parseInt(tidInput.value) : 0;

        var url = this.config.baseUrl + '/game/ajax/cards_my_deck.php?post_mode=1';
        if (tid > 0) {
            url += '&thread_id=' + tid;
        }
        var rpgRoot = document.querySelector('.rpg-system-container[data-active-char-id]');
        var activeCharId = rpgRoot ? parseInt(rpgRoot.getAttribute('data-active-char-id'), 10) : 0;
        if (activeCharId > 0) {
            url += '&character_id=' + activeCharId;
        }
        if (window.location.search.indexOf('debug_equipped=1') !== -1) {
            url += '&debug_equipped=1';
        }

        fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d.ok) return;
                var deckCards = self.filterPostDeckCards(d.data || [], d.meta, true);
                if (!deckCards.length) {
                    selector.classList.remove('is-hidden');
                    panel.innerHTML = '<div class="rpg-no-cards-msg"><i class="fas fa-briefcase"></i> No tienes cartas jugables. Equipa armas, compañeros o barcos en <strong>Gestión → Equipamiento</strong> para usarlos en posts.</div>';
                    return;
                }
                RpgCards.deckData = deckCards;
                self._metaData = d.meta;
                selector.classList.remove('is-hidden');

                var hint = document.getElementById('rpg-equipped-post-hint');
                if (!hint) {
                    hint = document.createElement('div');
                    hint.id = 'rpg-equipped-post-hint';
                    hint.className = 'rpg-deck-equipped-hint';
                    hint.innerHTML = '<i class="fas fa-info-circle"></i> Solo puedes usar equipo, compañeros y barcos que tengas <strong>equipados</strong> al publicar este post.';
                    selector.parentNode.insertBefore(hint, selector);
                }

                // Detect weapons and ammo
                var weapons = deckCards.filter(function(w) {
                    if (w.card_type !== 'equipo') return false;
                    var eff = w.effects || {};
                    return (eff.equipo_type || '').toLowerCase() === 'arma';
                });
                var ammo = deckCards.filter(function(a) {
                    if (a.card_type !== 'equipo') return false;
                    if (!a.tags) return false;
                    return a.tags.some(function(t) {
                        var clean = t.replace(/[\[\]]/g, '').trim().toUpperCase();
                        return clean.includes('MUNICION') || clean.includes('AMMO');
                    });
                });
                
                RpgCards.weapons = weapons;
                RpgCards.ammo = ammo;

                // Setup toggle panel
                toggleBtn.addEventListener('change', function(e) {
                    panel.classList[e.target.checked ? 'add' : 'remove']('is-visible');
                });
                if (toggleBtn.checked) panel.classList.add('is-visible');

                // Initialize cooldown mods
                if (!RpgCards._cooldownMods) {
                    RpgCards._cooldownMods = {};
                }

                self.renderDeckSelector();
                self.renderCooldownsList();

                self.updatePaUsage();
                if (typeof RpgPostDraft !== 'undefined') RpgPostDraft.restoreAfterStateLoaded();
            });
    },

    renderDeckSelector: function() {
        var panel = document.getElementById('rpg-card-deck-panel');
        if (!panel) return;

        var self = this;
        var deckCards = this.deckData || [];
        var meta = this._metaData;
        var weapons = this.weapons || [];
        var ammo = this.ammo || [];

        var grouped = {};
        deckCards.forEach(function(c) {
            if (!grouped[c.card_type]) grouped[c.card_type] = [];
            grouped[c.card_type].push(c);
        });

        var typeNames = {
            'tecnica':    'Técnicas',
            'equipo':     'Equipamiento',
            'haki':       'Haki',
            'npc_menor':  'NPCs Menores',
            'barco':      'Barcos'
        };
        var typeIcons = {
            'tecnica':    '<i class="fas fa-fist-raised rpg-deck-icon--tecnica"></i>',
            'equipo':     '<i class="fas fa-shield-alt rpg-deck-icon--equipo"></i>',
            'haki':       '<i class="fas fa-fire rpg-deck-icon--haki"></i>',
            'npc_menor':  '<i class="fas fa-users rpg-deck-icon--npc_menor"></i>',
            'barco':      '<i class="fas fa-ship rpg-deck-icon--barco"></i>'
        };

        var html = '';
        for (var type in grouped) {
            if (!Object.prototype.hasOwnProperty.call(grouped, type)) continue;
            var list = grouped[type];
            var icon = typeIcons[type] || '<i class="fas fa-layer-group"></i>';
            var name = typeNames[type] || type.toUpperCase();

            html +=
                '<div class="rpg-deck-section">' +
                    '<div class="rpg-deck-section-header" onclick="RpgCards.toggleDeckSection(\'' + type + '\',this)">' +
                        '<div class="rpg-deck-section-title">' +
                            icon + ' ' + name + ' <span class="rpg-deck-section-count">(' + list.length + ')</span>' +
                        '</div>' +
                        '<div class="rpg-deck-section-arrow"><i class="fas fa-chevron-down"></i></div>' +
                    '</div>' +
                    '<div id="rpg-deck-section-content-' + type + '" class="rpg-deck-section-content">';

            list.forEach(function(c) {
                var base_cooldown = c.reposo || 0;
                var duration = c.duracion || 0;

                // Cooldown evaluation (taking manual override into account)
                var computed_cooldown = (meta && meta.remaining_cooldowns && meta.remaining_cooldowns[c.id]) || 0;
                var remaining = self._cooldownMods[c.id] !== undefined ? self._cooldownMods[c.id] : computed_cooldown;

                var isDisabled  = false;
                var disabledAttr= '';
                var badgeHtml   = '';
                var overlayHtml = '';

                var qtyBadge = self._qtyBadgeHtml(c);
                var consumibleState = self._consumibleDisabledState(c);
                if (consumibleState) {
                    isDisabled   = consumibleState.isDisabled;
                    disabledAttr = consumibleState.disabledAttr;
                    overlayHtml  = consumibleState.overlayHtml;
                }

                if (remaining > 0) {
                    isDisabled   = true;
                    disabledAttr = 'data-disabled="true" data-cooldown-disabled="true"';
                    overlayHtml =
                        '<div class="rpg-card-cooldown-overlay">' +
                            '<i class="fas fa-hourglass-half"></i>' +
                            '<div class="rpg-card-cooldown-overlay__title">En Reposo</div>' +
                            '<div class="rpg-card-cooldown-overlay__sub">Falta ' + remaining + ' turno' + (remaining > 1 ? 's' : '') + '</div>' +
                        '</div>';
                }

                if (meta) {
                    var lastPlayed = meta.last_played_turns && meta.last_played_turns[c.id] || 0;
                    if (lastPlayed > 0) {
                        var elapsed = meta.total_posts - lastPlayed;
                        if (duration > 0 && elapsed + 1 < duration) {
                            var activeTurns = duration - (elapsed + 1);
                            badgeHtml =
                                '<span class="rpg-card-active-badge">' +
                                    '<i class="fas fa-circle"></i> ACTIVA (' + activeTurns + ')' +
                                '</span>';
                        }
                    }
                }

                var isSelected = self.selectedCards.indexOf(String(c.id)) !== -1 || self.selectedCards.indexOf(c.id) !== -1;
                var disabledClass = isDisabled ? ' is-disabled' : '';
                if (isSelected) disabledClass += ' selected';

                var attachmentsHtml = self.buildAttachmentsHtml(c, weapons, ammo);
                var rollOptionsHtml = self.buildRollOptionsHtml(c);
                var extrasInner = attachmentsHtml + rollOptionsHtml;
                var isVisibleClass = isSelected && extrasInner.trim() !== '' ? ' is-visible' : '';

                html +=
                    '<div class="rpg-selectable-card-container">' +
                        '<div class="rpg-selectable-card' + disabledClass + '" data-cid="' + c.id + '" ' + disabledAttr + '>' +
                            badgeHtml +
                            qtyBadge +
                            overlayHtml +
                            self.renderCard(c) +
                        '</div>' +
                        '<div class="rpg-card-attachments' + isVisibleClass + '">' +
                            extrasInner +
                        '</div>' +
                    '</div>';
            });

            html += '</div></div>';
        }

        panel.innerHTML = html;
        self._ensureRollModifierModal();

        // Bind selectable cards click event
        panel.querySelectorAll('.rpg-selectable-card').forEach(function(el) {
            el.addEventListener('click', function() {
                if (el.dataset.disabled === 'true' || el.dataset.disabledPa === 'true') return;

                var cid     = el.dataset.cid;
                var idx     = self.selectedCards.indexOf(String(cid));
                if (idx === -1) idx = self.selectedCards.indexOf(parseInt(cid, 10));
                
                var ct      = el.closest('.rpg-selectable-card-container');
                var attDiv  = ct ? ct.querySelector('.rpg-card-attachments') : null;

                if (idx === -1) {
                    self.selectedCards.push(String(cid));
                    el.classList.add('selected');
                    if (attDiv && attDiv.innerHTML.trim() !== '') attDiv.classList.add('is-visible');
                } else {
                    self.selectedCards.splice(idx, 1);
                    el.classList.remove('selected');
                    if (attDiv) attDiv.classList.remove('is-visible');
                }
                self.updatePlayedCardsInput();
                self.updatePaUsage();
                if (typeof RpgHiddenActions !== 'undefined') {
                    RpgHiddenActions.syncCardAvailability();
                }
            });
        });

        // Re-bind attachments change events
        panel.querySelectorAll('.rpg-card-attachments').forEach(function(att) {
            att.addEventListener('change', function(e) {
                if (e.target.classList.contains('rpg-attachment-weapon') ||
                    e.target.classList.contains('rpg-attachment-ammo')   ||
                    e.target.classList.contains('rpg-attachment-action')) {
                    self.updatePlayedCardsInput();
                    return;
                }
                if (e.target.classList.contains('rpg-card-roll-action')) {
                    if (e.target.value === 'modify') {
                        var cid = parseInt(e.target.dataset.cid, 10);
                        var cardObj = self.deckData && self.deckData.find(function(c) { return self._cardIdInt(c.id) === cid; });
                        self.openRollModifierModal(cid, cardObj ? cardObj.name : '', e.target.dataset.baseDice || (cardObj ? cardObj.dice : ''));
                    }
                    e.target.value = '';
                }
            });

            att.addEventListener('click', function(e) {
                var summary = e.target.closest('.rpg-roll-mod-summary.is-visible');
                if (!summary || !summary.dataset.cid) return;
                var cid = parseInt(summary.dataset.cid, 10);
                var cardObj = self.deckData && self.deckData.find(function(c) { return self._cardIdInt(c.id) === cid; });
                var selectEl = summary.closest('.rpg-roll-option-field');
                var baseDice = selectEl && selectEl.querySelector('.rpg-card-roll-action')
                    ? selectEl.querySelector('.rpg-card-roll-action').dataset.baseDice
                    : (cardObj ? cardObj.dice : '');
                self.openRollModifierModal(cid, cardObj ? cardObj.name : '', baseDice || (cardObj ? cardObj.dice : ''));
            });
        });
    },

    renderCooldownsList: function() {
        var container = document.getElementById('rpg-cooldowns-container');
        if (!container) return;

        var self = this;
        var deckCards = this.deckData || [];
        var meta = this._metaData;
        if (!meta) {
            container.innerHTML = '<div class="rpg-no-cooldowns-msg"><i class="fas fa-info-circle"></i> No hay información de cooldowns.</div>';
            return;
        }

        var remaining_cooldowns = meta.remaining_cooldowns || {};
        var activeCDs = [];

        deckCards.forEach(function(c) {
            var base_cooldown = c.reposo || 0;
            if (base_cooldown <= 0) return;

            var computed = remaining_cooldowns[c.id] || 0;
            var current = self._cooldownMods[c.id] !== undefined ? self._cooldownMods[c.id] : computed;

            if (computed > 0 || self._cooldownMods[c.id] !== undefined) {
                activeCDs.push({
                    card: c,
                    computed: computed,
                    current: current
                });
            }
        });

        if (activeCDs.length === 0) {
            container.innerHTML = 
                '<div class="rpg-no-cooldowns-msg"><i class="fas fa-info-circle"></i> No hay cooldowns activos en este turno.</div>' +
                self._buildCooldownAddDropdownHtml();
            return;
        }

        var html = '<div class="rpg-cooldown-list-items">';
        activeCDs.forEach(function(item) {
            var c = item.card;
            var cur = item.current;
            var isQuit = cur === 0;

            html += 
                '<div class="rpg-cooldown-item" data-card-id="' + c.id + '">' +
                    '<div class="rpg-cooldown-item__info">' +
                        '<div class="rpg-cooldown-item__name">' + c.name + '</div>' +
                        '<div class="rpg-cooldown-item__details">Base: ' + c.reposo + 't • original: ' + item.computed + 't</div>' +
                    '</div>' +
                    '<div class="rpg-cooldown-item__controls">' +
                        '<div class="rpg-cooldown-item__stepper">' +
                            '<button type="button" class="rpg-cooldown-item__btn" onclick="RpgCards.adjustCooldownMod(' + c.id + ', -1)">−</button>' +
                            '<span class="rpg-cooldown-item__val">' + cur + '</span>' +
                            '<button type="button" class="rpg-cooldown-item__btn" onclick="RpgCards.adjustCooldownMod(' + c.id + ', 1)">+</button>' +
                        '</div>' +
                        (isQuit
                            ? '<button type="button" class="rpg-cooldown-item__action-btn rpg-cooldown-item__action-btn--restore" onclick="RpgCards.adjustCooldownMod(' + c.id + ', ' + (item.computed - cur) + ')">Restaurar</button>'
                            : '<button type="button" class="rpg-cooldown-item__action-btn" onclick="RpgCards.adjustCooldownMod(' + c.id + ', -' + cur + ')">Quitar</button>'
                        ) +
                    '</div>' +
                '</div>';
        });
        html += '</div>';

        html += self._buildCooldownAddDropdownHtml();
        container.innerHTML = html;
    },

    _buildCooldownAddDropdownHtml: function() {
        var self = this;
        var deckCards = this.deckData || [];
        var meta = this._metaData;
        var remaining_cooldowns = (meta && meta.remaining_cooldowns) || {};

        var availableToAdd = deckCards.filter(function(c) {
            var base_cooldown = c.reposo || 0;
            if (base_cooldown <= 0) return false;
            
            var computed = remaining_cooldowns[c.id] || 0;
            return computed === 0 && self._cooldownMods[c.id] === undefined;
        });

        if (availableToAdd.length === 0) return '';

        var html = 
            '<div class="rpg-cooldown-add-wrap">' +
                '<select id="rpg-cooldown-add-select" class="rpg-cooldown-add-select">' +
                    '<option value="">— Añadir CD manual a… —</option>';
        availableToAdd.forEach(function(c) {
            html += '<option value="' + c.id + '">' + c.name + ' (CD ' + c.reposo + 't)</option>';
        });
        html += 
                '</select>' +
                '<button type="button" class="rpg-cooldown-add-btn" onclick="RpgCards.addManualCooldown()">Añadir</button>' +
            '</div>';

        return html;
    },

    addManualCooldown: function() {
        var select = document.getElementById('rpg-cooldown-add-select');
        if (!select || !select.value) return;

        var cardId = parseInt(select.value, 10);
        var card = (this.deckData || []).find(function(c) { return c.id === cardId; });
        if (!card) return;

        this._cooldownMods[cardId] = card.reposo || 1;
        this._updateCooldownInput();
        this.renderCooldownsList();
        this.renderDeckSelector();
        if (typeof RpgPostDraft !== 'undefined') RpgPostDraft.save();
    },

    adjustCooldownMod: function(cardId, delta) {
        if (!cardId) return;
        var computed = (this._metaData && this._metaData.remaining_cooldowns && this._metaData.remaining_cooldowns[cardId]) || 0;
        var current = this._cooldownMods[cardId] !== undefined ? this._cooldownMods[cardId] : computed;
        
        var next = current + delta;
        if (next < 0) next = 0;

        if (next === computed) {
            delete this._cooldownMods[cardId];
        } else {
            this._cooldownMods[cardId] = next;
        }

        this._updateCooldownInput();
        this.renderCooldownsList();
        this.renderDeckSelector();
        if (typeof RpgPostDraft !== 'undefined') RpgPostDraft.save();
    },

    _updateCooldownInput: function() {
        var input = document.getElementById('rpg_cooldown_mods');
        if (!input) return;
        input.value = JSON.stringify(this._cooldownMods || {});
    },

    // ──────────────────────────────────────────────────────────────────────────
    // TOGGLE SECCIONES DEL SELECTOR
    // ──────────────────────────────────────────────────────────────────────────

    toggleDeckSection: function(type, header) {
        var content = document.getElementById('rpg-deck-section-content-' + type);
        if (!content) return;
        var isOpen = content.classList.toggle('is-open');
        header.classList.toggle('is-open', isOpen);
    }
};

const RpgStats = {
    _maxPv: 0,
    _maxPe: 0,
    _maxPa: 10,
    _baseUrl: '',
    _baseRanks: {},
    _rankLabels: { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S', 6: 'SS' },

    _rankLabel: function(rankNum) {
        var n = parseInt(rankNum, 10) || 1;
        if (n <= 0) return '�';
        if (n <= 6) return this._rankLabels[n] || 'D';
        return 'SS' + '+'.repeat(Math.min(n - 6, 3));
    },

    _clampVital: function(kind, val) {
        var max = kind === 'pe' ? this._maxPe : this._maxPv;
        var ceiling = max > 0 ? max : 9999;
        return Math.max(0, Math.min(ceiling, val));
    },

    _parseFormula: function(base, formula) {
        var cleaned = String(formula || '').replace(/\s/g, '');
        if (!cleaned) return base;
        var parts = cleaned.match(/[+-]\d+/g);
        if (!parts) return base;
        var val = base;
        for (var i = 0; i < parts.length; i++) {
            val += parseInt(parts[i], 10);
        }
        return val;
    },

    _updateVitalDisplay: function(kind) {
        var input = document.getElementById(kind === 'pe' ? 'rpg-stat-pe-input' : 'rpg-stat-pv-input');
        var display = document.getElementById(kind === 'pe' ? 'rpg-stat-pe-display' : 'rpg-stat-pv-display');
        if (!input || !display) return;
        display.textContent = input.value;
    },

    _applyFormula: function(kind) {
        var formulaEl = document.getElementById(kind === 'pe' ? 'rpg-stat-pe-formula' : 'rpg-stat-pv-formula');
        var input = document.getElementById(kind === 'pe' ? 'rpg-stat-pe-input' : 'rpg-stat-pv-input');
        if (!input) return;
        var current = parseInt(input.value, 10);
        if (isNaN(current)) current = kind === 'pe' ? this._maxPe : this._maxPv;
        var next = this._clampVital(kind, this._parseFormula(current, formulaEl ? formulaEl.value : ''));
        input.value = next;
        if (formulaEl) formulaEl.value = '';
        this._updateVitalDisplay(kind);
        this.updateHiddenVitals();
    },

    init: function() {
        var panel = document.getElementById('rpg-stats-panel');
        if (!panel) return;

        var self = this;
        if (RpgCards && RpgCards.config && RpgCards.config.baseUrl) {
            this._baseUrl = RpgCards.config.baseUrl;
        } else {
            this._baseUrl = window.location.origin;
        }

        ['pv', 'pe'].forEach(function(kind) {
            var formulaEl = document.getElementById(kind === 'pe' ? 'rpg-stat-pe-formula' : 'rpg-stat-pv-formula');
            if (!formulaEl) return;
            formulaEl.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    self._applyFormula(kind);
                }
            });
            formulaEl.addEventListener('blur', function() {
                if (formulaEl.value.trim()) self._applyFormula(kind);
            });
        });

        panel.querySelectorAll('.rpg-stat-stepper').forEach(function(row) {
            row.querySelectorAll('.rpg-stat-stepper__btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    RpgCards.adjustStatMod(row.dataset.stat, parseInt(btn.dataset.delta, 10));
                });
            });
        });

        this.loadState();
    },

    loadState: function() {
        var tidInput = document.querySelector('input[name="tid"]');
        var tid = tidInput ? parseInt(tidInput.value, 10) : 0;
        var url = this._baseUrl + '/game/ajax/thread_pj_state.php?thread_id=' + (tid || 0);

        fetch(url, { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d.ok || !d.data) return;
                var data = d.data;
                RpgStats._maxPv = data.max_pv || 0;
                RpgStats._maxPe = data.max_pe || 0;
                RpgStats._maxPa = data.max_pa || 10;

                var pvMaxEl = document.getElementById('rpg-stat-pv-max');
                var peMaxEl = document.getElementById('rpg-stat-pe-max');
                var paMaxEl = document.getElementById('rpg-stat-pa-max');
                if (pvMaxEl) pvMaxEl.textContent = RpgStats._maxPv;
                if (peMaxEl) peMaxEl.textContent = RpgStats._maxPe;
                if (paMaxEl) paMaxEl.textContent = RpgStats._maxPa;

                var pvInput = document.getElementById('rpg-stat-pv-input');
                var peInput = document.getElementById('rpg-stat-pe-input');
                if (pvInput) pvInput.value = data.current_pv;
                if (peInput) peInput.value = data.current_pe;

                RpgStats._updateVitalDisplay('pv');
                RpgStats._updateVitalDisplay('pe');

                RpgStats._baseRanks = data.stats_ranks || {};
                RpgCards._modifiers = (data.stat_mods && !Array.isArray(data.stat_mods)) ? data.stat_mods : {};
                RpgStats.syncSteppers();
                RpgCards._renderModifierList();
                RpgCards._updateModifiersInput();
                RpgStats.updateHiddenVitals();
                RpgCards.updatePaUsage();
                if (typeof RpgPostDraft !== 'undefined') RpgPostDraft.restoreAfterStateLoaded();
            })
            .catch(function() {});
    },

    updateHiddenVitals: function() {
        var pvInput = document.getElementById('rpg-stat-pv-input');
        var peInput = document.getElementById('rpg-stat-pe-input');
        var pvHidden = document.getElementById('rpg_thread_pv');
        var peHidden = document.getElementById('rpg_thread_pe');
        if (pvHidden && pvInput) pvHidden.value = pvInput.value;
        if (peHidden && peInput) peHidden.value = peInput.value;
    },

    syncSteppers: function() {
        document.querySelectorAll('.rpg-stat-stepper').forEach(function(row) {
            var stat = row.dataset.stat;
            var valEl = row.querySelector('.rpg-stat-stepper__val');
            if (!valEl || !stat) return;
            var mod = (RpgCards._modifiers && RpgCards._modifiers[stat]) ? parseInt(RpgCards._modifiers[stat], 10) : 0;
            var base = parseInt(RpgStats._baseRanks[stat], 10) || 1;
            var resultRank = base + mod;
            var html = '<span class="rpg-stat-mod-result">' + RpgStats._rankLabel(resultRank) + '</span>';
            if (mod !== 0) {
                html += '<span class="rpg-stat-mod-delta">' + (mod > 0 ? '+' : '') + mod + '</span>';
            }
            valEl.innerHTML = html;
        });
    }
};

const RpgHiddenActions = {
    actions: [],
    
    init: function() {
        var listContainer = document.getElementById('rpg-hidden-actions-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        this.actions = [];
        this.serialize();
    },
    
    addAction: function() {
        var listContainer = document.getElementById('rpg-hidden-actions-list');
        if (!listContainer) return;
        
        var idx = this.actions.length + 1;
        this.actions.push({
            description: '',
            cards: []
        });
        
        var itemEl = document.createElement('div');
        itemEl.className = 'rpg-hidden-action-item';
        itemEl.dataset.idx = idx;
        
        itemEl.innerHTML = 
            '<div class="rpg-hidden-action-item-header">' +
                '<span class="rpg-hidden-action-title">Acci�n Oculta #' + idx + '</span>' +
                '<button type="button" class="rpg-btn-remove-hidden" onclick="RpgHiddenActions.removeAction(' + idx + ')">' +
                    '<i class="fas fa-trash-alt"></i>' +
                '</button>' +
            '</div>' +
            '<div class="rpg-hidden-action-body">' +
                '<textarea class="rpg-hidden-action-desc textbox" placeholder="Describe aquí la acción oculta o tirada secreta..." oninput="RpgHiddenActions.serialize()"></textarea>' +
                '<div class="rpg-hidden-action-cards-toggle-wrap">' +
                    '<button type="button" class="rpg-btn-toggle-cards" onclick="RpgHiddenActions.toggleCardsPanel(' + idx + ', this)">' +
                        '<i class="fas fa-layer-group"></i> Jugar Cartas en este Oculto (<span class="rpg-action-card-count">0</span>)' +
                    '</button>' +
                '</div>' +
                '<div class="rpg-hidden-action-deck-panel collapsed" id="rpg-hidden-deck-' + idx + '">' +
                '</div>' +
                '<div class="rpg-hidden-action-summary-chips"></div>' +
            '</div>';
            
        listContainer.appendChild(itemEl);
        
        // Render the deck accordion for this action
        var deckPanel = itemEl.querySelector('#rpg-hidden-deck-' + idx);
        this.renderDeckForAction(deckPanel, idx);
        
        this.serialize();
        this.syncCardAvailability();
    },
    
    removeAction: function(idxToRemove) {
        var listContainer = document.getElementById('rpg-hidden-actions-list');
        if (!listContainer) return;
        
        // Remove item from DOM
        var itemEl = listContainer.querySelector('.rpg-hidden-action-item[data-idx="' + idxToRemove + '"]');
        if (itemEl) itemEl.remove();
        
        // Re-index remaining action elements in DOM
        var items = listContainer.querySelectorAll('.rpg-hidden-action-item');
        var newActions = [];
        var self = this;
        
        items.forEach(function(item, index) {
            var newIdx = index + 1;
            item.dataset.idx = newIdx;
            
            // Update title text
            var titleEl = item.querySelector('.rpg-hidden-action-title');
            if (titleEl) titleEl.textContent = 'Acci�n Oculta #' + newIdx;
            
            // Update buttons and handlers
            var removeBtn = item.querySelector('.rpg-btn-remove-hidden');
            if (removeBtn) {
                removeBtn.setAttribute('onclick', 'RpgHiddenActions.removeAction(' + newIdx + ')');
            }
            
            var toggleBtn = item.querySelector('.rpg-btn-toggle-cards');
            if (toggleBtn) {
                toggleBtn.setAttribute('onclick', 'RpgHiddenActions.toggleCardsPanel(' + newIdx + ', this)');
            }
            
            var deckPanel = item.querySelector('.rpg-hidden-action-deck-panel');
            if (deckPanel) {
                deckPanel.id = 'rpg-hidden-deck-' + newIdx;
                // Update dataset on selectable cards inside this deck
                deckPanel.querySelectorAll('.rpg-hidden-selectable-card').forEach(function(card) {
                    card.dataset.actionIdx = newIdx;
                });
                
                // Update accordion section content IDs
                deckPanel.querySelectorAll('.rpg-deck-section-header').forEach(function(header) {
                    var oldOnclick = header.getAttribute('onclick');
                    var typeMatch = oldOnclick.match(/'([^']+)'/);
                    if (typeMatch) {
                        var type = typeMatch[1];
                        header.setAttribute('onclick', 'RpgHiddenActions.toggleDeckSection(' + newIdx + ', \'' + type + '\', this)');
                    }
                });
                
                deckPanel.querySelectorAll('.rpg-deck-section-content').forEach(function(content) {
                    var oldId = content.id;
                    var type = oldId.split('-').pop();
                    content.id = 'rpg-deck-section-content-hidden-' + newIdx + '-' + type;
                });
            }
            
            newActions.push({
                description: item.querySelector('.rpg-hidden-action-desc').value,
                cards: [] // Will be populated by serialize()
            });
        });
        
        this.actions = newActions;
        
        this.serialize();
        this.syncCardAvailability();
        RpgCards.updatePaUsage();
    },
    
    toggleCardsPanel: function(actionIdx, btn) {
        var panel = document.getElementById('rpg-hidden-deck-' + actionIdx);
        if (!panel) return;
        var isCollapsed = panel.classList.toggle('collapsed');
        btn.classList.toggle('active', !isCollapsed);
    },
    
    toggleDeckSection: function(actionIdx, type, header) {
        var content = document.getElementById('rpg-deck-section-content-hidden-' + actionIdx + '-' + type);
        if (!content) return;
        var isOpen = content.classList.toggle('is-open');
        header.classList.toggle('is-open', isOpen);
    },
    
    renderDeckForAction: function(container, actionIdx) {
        if (!RpgCards.deckData || !RpgCards.deckData.length) {
            container.innerHTML = '<div class="rpg-no-cards-msg">No hay cartas disponibles.</div>';
            return;
        }
        
        var self = this;
        var grouped = {};
        RpgCards.deckData.forEach(function(c) {
            if (!grouped[c.card_type]) grouped[c.card_type] = [];
            grouped[c.card_type].push(c);
        });
        
        var typeNames = {
            'tecnica':    'Técnicas',
            'equipo':     'Equipamiento',
            'haki':       'Haki',
            'npc_menor':  'NPCs Menores',
            'barco':      'Barcos'
        };
        var typeIcons = {
            'tecnica':    '<i class="fas fa-fist-raised rpg-deck-icon--tecnica"></i>',
            'equipo':     '<i class="fas fa-shield-alt rpg-deck-icon--equipo"></i>',
            'haki':       '<i class="fas fa-fire rpg-deck-icon--haki"></i>',
            'npc_menor':  '<i class="fas fa-users rpg-deck-icon--npc_menor"></i>',
            'barco':      '<i class="fas fa-ship rpg-deck-icon--barco"></i>'
        };
        
        var html = '';
        for (var type in grouped) {
            if (!Object.prototype.hasOwnProperty.call(grouped, type)) continue;
            var list = grouped[type];
            var icon = typeIcons[type] || '<i class="fas fa-layer-group"></i>';
            var name = typeNames[type] || type.toUpperCase();
            var secId = 'rpg-deck-section-content-hidden-' + actionIdx + '-' + type;
            
            html +=
                '<div class="rpg-deck-section">' +
                    '<div class="rpg-deck-section-header" onclick="RpgHiddenActions.toggleDeckSection(' + actionIdx + ', \'' + type + '\', this)">' +
                        '<div class="rpg-deck-section-title">' +
                            icon + ' ' + name + ' <span class="rpg-deck-section-count">(' + list.length + ')</span>' +
                        '</div>' +
                        '<div class="rpg-deck-section-arrow"><i class="fas fa-chevron-down"></i></div>' +
                    '</div>' +
                    '<div id="' + secId + '" class="rpg-deck-section-content">';
                    
            list.forEach(function(c) {
                var cooldown = c.reposo   || 0;
                var duration = c.duracion || 0;
                
                var isDisabled  = false;
                var disabledAttr= '';
                var badgeHtml   = '';
                var overlayHtml = '';
                
                var qtyBadge = RpgCards._qtyBadgeHtml(c);
                var consumibleState = RpgCards._consumibleDisabledState(c);
                if (consumibleState) {
                    isDisabled   = consumibleState.isDisabled;
                    disabledAttr = 'data-disabled="true" data-exhausted-disabled="true"';
                    overlayHtml  = consumibleState.overlayHtml;
                }
                
                var meta = RpgCards._metaData;
                if (meta) {
                    var lastPlayed = meta.last_played_turns[c.id] || 0;
                    if (lastPlayed > 0) {
                        var elapsed = meta.total_posts - lastPlayed;
                        if (cooldown > 0 && elapsed < cooldown) {
                            isDisabled   = true;
                            disabledAttr = 'data-disabled="true" data-cooldown-disabled="true"';
                            var remaining = cooldown - elapsed;
                            overlayHtml =
                                '<div class="rpg-card-cooldown-overlay">' +
                                    '<i class="fas fa-hourglass-half"></i>' +
                                    '<div class="rpg-card-cooldown-overlay__title">En Reposo</div>' +
                                    '<div class="rpg-card-cooldown-overlay__sub">Falta ' + remaining + ' T</div>' +
                                '</div>';
                        }
                        if (duration > 0 && elapsed + 1 < duration) {
                            var activeTurns = duration - (elapsed + 1);
                            badgeHtml =
                                '<span class="rpg-card-active-badge">' +
                                    '<i class="fas fa-circle"></i> ACTIVA (' + activeTurns + ')' +
                                '</span>';
                        }
                    }
                }
                
                var disabledClass = isDisabled ? ' is-disabled' : '';
                var attachmentsHtml = RpgCards.buildAttachmentsHtml(c, RpgCards.weapons || [], RpgCards.ammo || []);
                
                html +=
                    '<div class="rpg-selectable-card-container">' +
                        '<div class="rpg-hidden-selectable-card' + disabledClass + '" data-cid="' + c.id + '" data-action-idx="' + actionIdx + '" ' + disabledAttr + '>' +
                            badgeHtml +
                            qtyBadge +
                            overlayHtml +
                            RpgCards.renderCard(c) +
                        '</div>' +
                        '<div class="rpg-card-attachments">' +
                            attachmentsHtml +
                        '</div>' +
                    '</div>';
            });
            
            html += '</div></div>';
        }
        
        container.innerHTML = html;
        
        // Add click event listeners
        container.querySelectorAll('.rpg-hidden-selectable-card').forEach(function(cardEl) {
            cardEl.addEventListener('click', function() {
                if (cardEl.dataset.disabled === 'true' || cardEl.dataset.disabledPa === 'true') return;
                
                var cid = cardEl.dataset.cid;
                var ct = cardEl.closest('.rpg-selectable-card-container');
                var attDiv = ct ? ct.querySelector('.rpg-card-attachments') : null;
                
                if (cardEl.classList.contains('selected')) {
                    cardEl.classList.remove('selected');
                    if (attDiv) attDiv.classList.remove('is-visible');
                } else {
                    cardEl.classList.add('selected');
                    if (attDiv && attDiv.innerHTML.trim() !== '') attDiv.classList.add('is-visible');
                }
                self.updateSummaryChips(actionIdx);
                self.serialize();
                self.syncCardAvailability();
                RpgCards.updatePaUsage();
            });
        });
        
        // Attachments change listener
        container.addEventListener('change', function(e) {
            if (e.target.classList.contains('rpg-attachment-weapon') ||
                e.target.classList.contains('rpg-attachment-ammo')   ||
                e.target.classList.contains('rpg-attachment-action')) {
                self.serialize();
            }
        });
    },
    
    updateSummaryChips: function(actionIdx) {
        var itemEl = document.querySelector('.rpg-hidden-action-item[data-idx="' + actionIdx + '"]');
        if (!itemEl) return;
        var summaryCt = itemEl.querySelector('.rpg-hidden-action-summary-chips');
        var cardCountSpan = itemEl.querySelector('.rpg-action-card-count');
        if (!summaryCt) return;
        
        summaryCt.innerHTML = '';
        var selectedCards = itemEl.querySelectorAll('.rpg-hidden-selectable-card.selected');
        cardCountSpan.textContent = selectedCards.length;
        
        selectedCards.forEach(function(cardEl) {
            var cid = parseInt(cardEl.dataset.cid);
            var cardObj = RpgCards.deckData.find(function(c) { return c.id === cid; });
            if (cardObj) {
                var chip = document.createElement('span');
                chip.className = 'rpg-card-summary-chip';
                chip.innerHTML = '<i class="fas fa-info-circle"></i> ' + cardObj.name + ' <span class="rpg-card-summary-chip-rank">' + cardObj.rank + '</span>';
                summaryCt.appendChild(chip);
            }
        });
    },
    
    serialize: function() {
        var input = document.getElementById('rpg_hidden_actions');
        if (!input) return;
        
        var payload = [];
        var items = document.querySelectorAll('.rpg-hidden-action-item');
        
        items.forEach(function(itemEl) {
            var idx = parseInt(itemEl.dataset.idx);
            var descText = itemEl.querySelector('.rpg-hidden-action-desc').value;
            
            var actionCards = [];
            var selectedCards = itemEl.querySelectorAll('.rpg-hidden-selectable-card.selected');
            
            selectedCards.forEach(function(cardEl) {
                var cid = parseInt(cardEl.dataset.cid);
                var container = cardEl.closest('.rpg-selectable-card-container');
                var attachmentsCt = container ? container.querySelector('.rpg-card-attachments') : null;
                
                if (attachmentsCt && attachmentsCt.classList.contains('is-visible')) {
                    var weaponSelects = attachmentsCt.querySelectorAll('.rpg-attachment-weapon');
                    var ammoSelects = attachmentsCt.querySelectorAll('.rpg-attachment-ammo');
                    var actionSelect = attachmentsCt.querySelector('.rpg-attachment-action');
                    
                    var weapons = [];
                    weaponSelects.forEach(function(sel) { if (sel.value) weapons.push(parseInt(sel.value)); });
                    
                    var ammo = [];
                    ammoSelects.forEach(function(sel) { if (sel.value) ammo.push(parseInt(sel.value)); });
                    
                    var cardItem = { card_id: cid };
                    var hasExtra = false;
                    
                    if (weapons.length > 0) { cardItem.weapons = weapons; hasExtra = true; }
                    if (ammo.length > 0) { cardItem.ammo = ammo; hasExtra = true; }
                    if (actionSelect && actionSelect.value) { cardItem.selected_action = actionSelect.value; hasExtra = true; }
                    
                    actionCards.push(hasExtra ? cardItem : cid);
                } else {
                    actionCards.push(cid);
                }
            });
            
            payload.push({
                index: idx,
                description: descText,
                cards: actionCards
            });
        });
        
        input.value = JSON.stringify(payload);
    },

    restoreFromJson: function(jsonStr) {
        var items;
        try { items = JSON.parse(jsonStr); } catch (e) { return; }
        if (!Array.isArray(items) || !items.length) return;
        this.init();
        var self = this;
        items.forEach(function(action) {
            self.addAction();
            var itemEl = document.querySelector('.rpg-hidden-action-item:last-child');
            if (!itemEl) return;
            var desc = itemEl.querySelector('.rpg-hidden-action-desc');
            if (desc) desc.value = action.description || '';
            var cards = action.cards || [];
            var idx = parseInt(itemEl.dataset.idx, 10);
            cards.forEach(function(entry) {
                var cid = (typeof entry === 'object' && entry) ? parseInt(entry.card_id, 10) : parseInt(entry, 10);
                if (!cid) return;
                var cardEl = itemEl.querySelector('.rpg-hidden-selectable-card[data-cid="' + cid + '"]');
                if (cardEl) cardEl.classList.add('selected');
            });
            self.updateSummaryChips(idx);
        });
        this.serialize();
        this.syncCardAvailability();
    },
    
    syncCardAvailability: function() {
        var normalSelected = [];
        document.querySelectorAll('#rpg-card-deck-panel .rpg-selectable-card.selected').forEach(function(el) {
            normalSelected.push(parseInt(el.dataset.cid));
        });
        
        var hiddenSelectedByAction = {};
        var allHiddenSelected = [];
        
        document.querySelectorAll('.rpg-hidden-selectable-card.selected').forEach(function(el) {
            var actionIdx = parseInt(el.dataset.actionIdx);
            var cid = parseInt(el.dataset.cid);
            if (!hiddenSelectedByAction[actionIdx]) hiddenSelectedByAction[actionIdx] = [];
            hiddenSelectedByAction[actionIdx].push(cid);
            allHiddenSelected.push(cid);
        });
        
        document.querySelectorAll('#rpg-card-deck-panel .rpg-selectable-card').forEach(function(el) {
            var cid = parseInt(el.dataset.cid);
            var originDisabled = el.dataset.cooldownDisabled === 'true' || el.dataset.exhaustedDisabled === 'true';
            
            if (originDisabled) return;
            
            if (allHiddenSelected.indexOf(cid) !== -1) {
                el.classList.add('is-disabled');
                el.dataset.disabled = 'true';
            } else {
                el.classList.remove('is-disabled');
                el.dataset.disabled = 'false';
            }
        });
        
        document.querySelectorAll('.rpg-hidden-selectable-card').forEach(function(el) {
            var cid = parseInt(el.dataset.cid);
            var actionIdx = parseInt(el.dataset.actionIdx);
            var originDisabled = el.dataset.cooldownDisabled === 'true' || el.dataset.exhaustedDisabled === 'true';
            
            if (originDisabled) return;
            
            var selectedInNormal = normalSelected.indexOf(cid) !== -1;
            var selectedInOtherHidden = false;
            
            for (var aIdx in hiddenSelectedByAction) {
                if (parseInt(aIdx) !== actionIdx) {
                    if (hiddenSelectedByAction[aIdx].indexOf(cid) !== -1) {
                        selectedInOtherHidden = true;
                        break;
                    }
                }
            }
            
            if (selectedInNormal || selectedInOtherHidden) {
                el.classList.add('is-disabled');
                el.dataset.disabled = 'true';
            } else {
                el.classList.remove('is-disabled');
                el.dataset.disabled = 'false';
            }
        });
    }
};

/* API global explícita (const no se asigna a window en scripts clásicos) */
if (typeof window !== 'undefined') {
    window.RpgCards = RpgCards;
    window.RpgStats = RpgStats;
    window.RpgHiddenActions = RpgHiddenActions;
}

document.addEventListener('DOMContentLoaded', function() {
    if (typeof RpgPostDraft !== 'undefined') RpgPostDraft.initOnLoad();
    RpgCards.init();
    RpgStats.init();
    if (typeof RpgHiddenActions !== 'undefined') {
        RpgHiddenActions.init();
    }
    RpgTemplatePicker.init();
    RpgPostPreview.init();
});

function insertTemplateContent(template) {
    if (typeof MyBBEditor !== 'undefined' && MyBBEditor) {
        MyBBEditor.insertText(template);
    } else {
        var $ = window.jQuery;
        if ($ && $('#message').length && $('#message').data('sceditor')) {
            $('#message').sceditor('instance').insertText(template);
        } else {
            var textarea = document.getElementById('message');
            if (textarea) {
                var start = textarea.selectionStart;
                var end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + template + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + template.length;
                textarea.focus();
            }
        }
    }
}

function syncEditorToTextarea() {
    var editor = document.getElementById('message');
    if (!editor) return;
    if (typeof MyBBEditor !== 'undefined' && MyBBEditor && typeof MyBBEditor.updateOriginal === 'function') {
        MyBBEditor.updateOriginal();
        return;
    }
    if (window.jQuery && window.jQuery('#message').length && window.jQuery('#message').data('sceditor')) {
        window.jQuery('#message').sceditor('instance').updateOriginal();
        return;
    }
    if (window.sceditor) {
        try {
            var inst = window.sceditor.instance(editor);
            if (inst && typeof inst.updateOriginal === 'function') {
                inst.updateOriginal();
            }
        } catch (e) {}
    }
}

function syncRpgFormState() {
    syncEditorToTextarea();
    if (typeof RpgCards !== 'undefined' && RpgCards.updatePlayedCardsInput) RpgCards.updatePlayedCardsInput();
    if (typeof RpgHiddenActions !== 'undefined' && RpgHiddenActions.serialize) RpgHiddenActions.serialize();
    if (typeof RpgCards !== 'undefined' && RpgCards._updateModifiersInput) RpgCards._updateModifiersInput();
    if (typeof RpgCards !== 'undefined' && RpgCards._updateCooldownInput) RpgCards._updateCooldownInput();
    if (typeof RpgStats !== 'undefined' && RpgStats.updateHiddenVitals) RpgStats.updateHiddenVitals();
}

var RpgPostDraft = {
    _key: 'rpg_post_draft_v1',
    _restored: false,

    isPreviewReturn: function() {
        return !!document.querySelector('.rpg-preview-post');
    },

    initOnLoad: function() {
        if (!document.getElementById('rpg_played_cards')) return;
        if (!this.isPreviewReturn()) {
            this.clear();
        }
    },

    save: function() {
        syncRpgFormState();
        try {
            var state = {
                cards: (document.getElementById('rpg_played_cards') || {}).value || '',
                hidden: (document.getElementById('rpg_hidden_actions') || {}).value || '',
                mods: (document.getElementById('rpg_modifiers') || {}).value || '',
                cdMods: (document.getElementById('rpg_cooldown_mods') || {}).value || '',
                pv: (document.getElementById('rpg_thread_pv') || {}).value || '',
                pe: (document.getElementById('rpg_thread_pe') || {}).value || ''
            };
            sessionStorage.setItem(this._key, JSON.stringify(state));
        } catch (e) {}
    },

    restoreAfterStateLoaded: function() {
        if (this._restored) return;
        if (!document.getElementById('rpg_played_cards')) return;
        if (!this.isPreviewReturn()) return;
        var raw;
        try { raw = sessionStorage.getItem(this._key); } catch (e) { return; }
        if (!raw) return;
        var state;
        try { state = JSON.parse(raw); } catch (e) { return; }
        this._restored = true;

        var cardsEl = document.getElementById('rpg_played_cards');
        var hiddenEl = document.getElementById('rpg_hidden_actions');
        var modsEl = document.getElementById('rpg_modifiers');
        var cdModsEl = document.getElementById('rpg_cooldown_mods');
        if (state.cards && cardsEl) cardsEl.value = state.cards;
        if (state.mods && modsEl) {
            modsEl.value = state.mods;
            try {
                RpgCards._modifiers = JSON.parse(state.mods) || {};
            } catch (e) { RpgCards._modifiers = {}; }
            RpgStats.syncSteppers();
            RpgCards._renderModifierList();
        }
        if (state.cdMods && cdModsEl) {
            cdModsEl.value = state.cdMods;
            try {
                RpgCards._cooldownMods = JSON.parse(state.cdMods) || {};
            } catch (e) { RpgCards._cooldownMods = {}; }
            RpgCards.renderCooldownsList();
            RpgCards.renderDeckSelector();
        }
        if (state.pv) {
            var pvIn = document.getElementById('rpg-stat-pv-input');
            if (pvIn) pvIn.value = state.pv;
            RpgStats._updateVitalDisplay('pv');
        }
        if (state.pe) {
            var peIn = document.getElementById('rpg-stat-pe-input');
            if (peIn) peIn.value = state.pe;
            RpgStats._updateVitalDisplay('pe');
        }
        RpgStats.updateHiddenVitals();

        if (state.hidden && hiddenEl && typeof RpgHiddenActions !== 'undefined') {
            hiddenEl.value = state.hidden;
            RpgHiddenActions.restoreFromJson(state.hidden);
        }
        if (state.cards && typeof RpgCards !== 'undefined' && RpgCards.restorePlayedCardsFromJson) {
            RpgCards.restorePlayedCardsFromJson(state.cards);
        }
    },

    clear: function() {
        try { sessionStorage.removeItem(this._key); } catch (e) {}
    }
};

var RpgPostPreview = {
    init: function() {
        document.querySelectorAll('#rpg-preview-submit').forEach(function(btn) {
            btn.addEventListener('click', function() {
                RpgPostDraft.save();
            });
        });
        document.querySelectorAll('form').forEach(function(form) {
            if (!form.querySelector('#rpg_played_cards')) return;
            form.addEventListener('submit', function(e) {
                var sub = e.submitter;
                if (sub && (sub.name === 'previewpost' || sub.id === 'rpg-preview-submit')) {
                    syncRpgFormState();
                    RpgPostDraft.save();
                } else if (sub && (sub.name === 'submit' || sub.type === 'submit')) {
                    syncRpgFormState();
                    RpgPostDraft.clear();
                }
            });
        });
    }
};

var RpgTemplatePicker = {
    menuOpen: false,

    getBaseUrl: function() {
        var nav = document.getElementById('pj-nav-submenu');
        return (nav && nav.dataset.base) ? nav.dataset.base : window.location.origin;
    },

    closeMenu: function() {
        document.querySelectorAll('.rpg-template-dropdown .rpg-editor-dropdown-menu').forEach(function(menu) {
            menu.classList.remove('show');
        });
        this.menuOpen = false;
    },

    openMenu: function(menu, templates) {
        menu.innerHTML = '';
        var list = document.createElement('ul');
        list.className = 'rpg-template-menu-list';
        templates.forEach(function(t, i) {
            var li = document.createElement('li');
            li.className = 'rpg-template-menu-item';
            li.setAttribute('role', 'option');
            li.textContent = t.name || ('Template ' + (i + 1));
            li.addEventListener('click', function() {
                insertTemplateContent(t.content);
                RpgTemplatePicker.closeMenu();
            });
            list.appendChild(li);
        });
        menu.appendChild(list);
        menu.classList.add('show');
        RpgTemplatePicker.menuOpen = true;
    },

    loadTemplates: function(charId, callback) {
        var baseUrl = this.getBaseUrl();
        fetch(baseUrl + '/game/ajax/post_template.php?character_id=' + charId)
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d.ok || !d.data) {
                    callback([]);
                    return;
                }
                callback(d.data.templates || []);
            })
            .catch(function() { callback(null); });
    },

    handleTrigger: function(trigger) {
        var container = trigger.closest('.rpg-system-container[data-active-char-id]');
        if (!container) return;
        var charId = parseInt(container.getAttribute('data-active-char-id'), 10);
        if (!charId) {
            alert('No hay personaje activo. Selecciona uno en Mis Personajes.');
            return;
        }
        var dropdown = trigger.closest('.rpg-template-dropdown');
        var menu = dropdown ? dropdown.querySelector('.rpg-editor-dropdown-menu') : null;
        if (!menu) return;

        if (menu.classList.contains('show')) {
            this.closeMenu();
            return;
        }

        var self = this;
        this.loadTemplates(charId, function(templates) {
            if (templates === null) {
                alert('Error de conexion al cargar templates.');
                return;
            }
            if (!templates.length) {
                alert('No hay template configurado para este personaje. Puedes configurarlo desde tu menu de usuario > Templates.');
                return;
            }
            if (templates.length === 1) {
                insertTemplateContent(templates[0].content);
                return;
            }
            self.closeMenu();
            self.openMenu(menu, templates);
        });
    },

    init: function() {
        var self = this;
        document.querySelectorAll('#rpg-template-trigger').forEach(function(trigger) {
            trigger.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                self.handleTrigger(trigger);
            });
        });
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.rpg-template-dropdown')) {
                self.closeMenu();
            }
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') self.closeMenu();
        });
    }
};

function insertPostTemplate() {
    var trigger = document.getElementById('rpg-template-trigger');
    if (trigger) RpgTemplatePicker.handleTrigger(trigger);
}

/* legacy stub — preview uses native MyBB previewpost submit */
var RpgSystem = RpgSystem || {};
RpgSystem.openPreview = function() {
    syncEditorToTextarea();
    var btn = document.getElementById('rpg-preview-submit');
    if (btn) btn.click();
};
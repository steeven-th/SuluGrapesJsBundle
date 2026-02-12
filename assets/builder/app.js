import grapesjs from 'grapesjs';
import plugin from 'grapesjs-preset-webpage';
import blocksBasic from 'grapesjs-blocks-basic'; //https://github.com/GrapesJS/blocks-basic
import bg from 'grapesjs-style-bg'; //https://github.com/GrapesJS/tui-image-editor
import 'grapick/dist/grapick.min.css';
import customCode from 'grapesjs-custom-code'; //https://github.com/GrapesJS/components-custom-code
import tooltip from 'grapesjs-tooltip'; //https://github.com/GrapesJS/components-tooltip
import typed from 'grapesjs-typed'; //https://github.com/GrapesJS/components-typed
import filter from 'grapesjs-style-filter'; //https://github.com/GrapesJS/style-filter
import countdown from 'grapesjs-component-countdown'; //https://github.com/GrapesJS/components-countdown
import tuiImageEditor from 'grapesjs-tui-image-editor'; //https://github.com/GrapesJS/tui-image-editor
import grapesjsObjectFit from 'grapesjs-object-fit'; //https://github.com/steeven-th/grapesjs-object-fit
import rteExtension from 'grapesjs-rte-toolbar-extensions'; //https://github.com/steeven-th/grapesjs-rte-toolbar-extensions
import de from 'grapesjs/locale/de';
import fr from 'grapesjs/locale/fr';

const root = document.getElementById('sulu-page-builder');
const translations = JSON.parse(root.getAttribute('data-translations') || '{}');
function t(key, params = {}) {
    const value = key.split('.').reduce((obj, k) => (obj || {})[k], translations) || '';
    if (typeof params === 'object' && params !== null) {
        return value.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? '');
    }
    return value;
}

const saveButton = document.getElementById('save');
const publishButton = document.getElementById('publish');

// --- Synchronization with the Sulu admin FormStore (preview mode) ---
let lastSentHtml = null;
let lastSentCss = null;

function getPreviewTarget() {
    return window.parent !== window ? window.parent : window.opener;
}

// Full sync: sends data AND triggers a preview re-render.
// Forces commit of inline edits before reading HTML.
function notifyParentOfChanges(editorInstance) {
    // Force GrapeJS to commit inline edits ONLY when the RTE is active
    // (prevents corrupting structural components via sync:content)
    const rte = editorInstance.RichTextEditor;
    if (rte && typeof rte.getToolbarEl === 'function' && rte.getToolbarEl()?.style?.display !== 'none') {
        const selected = editorInstance.getSelected();
        if (selected) {
            selected.trigger('sync:content');
        }
    }

    // Cancel pending timer to avoid a crossed message after re-render
    clearTimeout(_pendingTimer);

    const currentHtml = editorInstance.getHtml();
    const currentCss = editorInstance.getCss();

    lastSentHtml = currentHtml;
    lastSentCss = currentCss;

    const target = getPreviewTarget();
    if (target) {
        target.postMessage({
            type: 'sulu-grapes-update',
            html: currentHtml,
            css: currentCss,
        }, window.location.origin);
    }
}

// Silent sync: sends data to the parent without triggering a re-render.
// The parent stores the data and marks the FormStore dirty ("unsaved changes" alert).
let _pendingTimer;
function sendPendingToParent(editorInstance) {
    clearTimeout(_pendingTimer);
    _pendingTimer = setTimeout(() => {
        // No sync:content here — sendPendingToParent is silent and must not
        // interfere with inline editing (cursor loss).
        // Precise commit is done in notifyParentOfChanges (explicit Sync).
        const currentHtml = editorInstance.getHtml();
        const currentCss = editorInstance.getCss();
        const target = getPreviewTarget();
        if (target) {
            target.postMessage({
                type: 'sulu-grapes-pending',
                html: currentHtml,
                css: currentCss,
            }, window.location.origin);
        }
    }, 1000);
}

// --- Standalone mode: pagination state ---
const MEDIA_PAGE_SIZE = 20;

let _currentImagePage = 1;
let _totalImagePages = 1;
let _imageSearchQuery = '';

let _currentDocPage = 1;
let _totalDocPages = 1;
let _docSearchQuery = '';

/**
 * Loads image assets from Sulu with pagination and search support.
 *
 * @param {string} locale - Current locale
 * @param {number} page - Page number (1-based)
 * @param {string} search - Search query
 * @returns {Promise<Array>} Array of image asset objects for GrapeJS
 */
const loadImagesAssetsFromSulu = async (locale, page = 1, search = '') => {
    try {
        let url = `/admin/api/media?locale=${encodeURIComponent(locale)}&filter[type]=image&limit=${MEDIA_PAGE_SIZE}&page=${page}`;
        if (search) {
            url += `&search=${encodeURIComponent(search)}&searchFields=title,name`;
        }

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include',
        });

        const data = await response.json();

        _currentImagePage = data.page || 1;
        _totalImagePages = data.pages || 1;

        return data._embedded.media.map((media) => ({
            type: 'image',
            src: media.thumbnails?.['sulu-170x170'] || media.url,
            name: media.title || media.name,
            // Custom properties for retrieval on selection
            mediaId: media.id,
            mediaUrl: media.url,
            mediaThumbnails: Object.fromEntries(
                Object.entries(media.thumbnails || {}).filter(([key]) => !key.includes('.'))
            ),
        }));
    } catch (err) {
        console.error(t('console_error.load_images_assets_from_sulu'), err);
        return [];
    }
};

/**
 * Loads document assets from Sulu with pagination and search support.
 *
 * @param {string} locale - Current locale
 * @param {number} page - Page number (1-based)
 * @param {string} search - Search query
 * @returns {Promise<Array>} Array of document asset objects for GrapeJS
 */
const loadDocumentsAssetsFromSulu = async (locale, page = 1, search = '') => {
    try {
        let url = `/admin/api/media?locale=${encodeURIComponent(locale)}&filter[type]=document&limit=${MEDIA_PAGE_SIZE}&page=${page}`;
        if (search) {
            url += `&search=${encodeURIComponent(search)}&searchFields=title,name`;
        }

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include',
        });

        const data = await response.json();

        _currentDocPage = data.page || 1;
        _totalDocPages = data.pages || 1;

        return data._embedded.media.map((media) => ({
            type: 'document',
            name: media.title || media.name,
            src: media.url,
            // Custom properties for retrieval on selection
            mediaId: media.id,
            mediaUrl: media.url,
        }));
    } catch (err) {
        console.error(t('console_error.load_documents_assets_from_sulu'), err);
        return [];
    }
};

/**
 * Loads available image formats from the Sulu API.
 * Stored in memory for future format selector feature.
 *
 * @param {string} locale - Current locale
 * @returns {Promise<Array>} Array of format objects
 */
const loadImageFormats = async (locale) => {
    try {
        const response = await fetch(`/admin/api/formats.json?locale=${locale}`, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include',
        });
        const data = await response.json();
        return data._embedded?.formats || [];
    } catch (err) {
        console.error('Error loading image formats', err);
        return [];
    }
};

function updateSaveIconState(isModified) {
    const saveIcon = document.querySelector('#save i');
    if (saveIcon) {
        saveIcon.style.color = isModified ? 'orange' : '';
        saveButton.disabled = !isModified;
    }
}

async function save(editor, data, saveUrl) {
    if (!saveUrl || !editor) return { id: 1, data, pagesHtml: [] };

    const saveButton = document.querySelector('#save');
    const saveIcon = saveButton?.querySelector('i');
    const publishButton = document.querySelector('#publish');

    if (saveIcon) saveIcon.style.color = 'orange';
    if (saveButton) saveButton.disabled = true;

    const pages = editor.Pages.getAll();
    const pagesHtml = [];

    try {
        for (const page of pages) {
            const component = page.getMainComponent();
            const html = editor.getHtml({ component });
            const css = editor.getCss({ component });

            const response = await fetch(saveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html, css }),
            });

            const responseData = await response.json();
            if (!response.ok || !responseData.success) {
                throw new Error(responseData.error || t('errors.server_error'));
            }

            console.log(`✅ ${t('messages.save_success')}`);

            pagesHtml.push({
                html,
                css,
            });
        }

        if (publishButton) publishButton.disabled = false;
        if (saveButton) saveButton.disabled = true;

        if (saveIcon) {
            setTimeout(() => {
                saveIcon.style.color = '';
            }, 1000);
        }

        return { id: 1, data, pagesHtml };
    } catch (err) {
        if (saveButton) saveButton.disabled = false;
        console.error(`❌ ${t('console_error.save_error')}`, err);
        if (saveIcon) saveIcon.style.color = '';
        throw err;
    }
}

async function publish(publishUrl) {
    const publishButton = document.querySelector('#publish');
    const publishIcon = publishButton.querySelector('i');

    // Change color to orange during publishing
    publishIcon.style.color = 'orange';
    publishButton.disabled = true;

    try {
        const response = await fetch(publishUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const responseData = await response.json();
        if (!response.ok || !responseData.success) {
            throw new Error(responseData.error || 'Server error');
        }

        publishButton.disabled = true;

        // Reset color to default after 1 second
        setTimeout(() => {
            publishIcon.style.color = '';
        }, 1000);

        console.log(`✅ ${t('messages.publish_success')}`);
    } catch (err) {
        console.error(`❌ ${t('messages.publish_error')}`, err);
        throw err;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const containerId = 'sulu-page-builder';
    const root = document.getElementById(containerId);

    if (!root) {
        console.error(t('grapesjs.console_error.container_not_found', { containerId: containerId }));
        return;
    }

    const saveUrl = root.getAttribute('data-save-url');
    if (!saveUrl) {
        console.warn(t('grapesjs.console_warn.save_url_missing', { containerId: containerId }));
    }

    const publishUrl = root.getAttribute('data-publish-url');
    if (!publishUrl) {
        console.warn(t('grapesjs.console_warn.publish_url_missing', { containerId: containerId }));
    }

    const frontendCssPath = root.getAttribute('data-frontend-css-path');
    const frontendJsPath = root.getAttribute('data-frontend-js-path');

    const jsonBuilderHtml = root.getAttribute('data-json-builder-html');
    const jsonBuilderCss = root.getAttribute('data-json-builder-css');
    const locale = root.getAttribute('data-locale');
    const detachedNativeMedia = root.getAttribute('data-detached-native-media') === 'true';

    // Preview mode detection (no save button = preview mode)
    const isPreviewMode = !saveButton;

    // Detached preview = preview mode opened in a separate browser window (popup)
    // Inline preview = preview mode inside Sulu admin iframe
    const isInlinePreview = isPreviewMode && window.parent !== window;
    const isDetachedPreview = isPreviewMode && window.parent === window;

    // Determine which media selection method to use:
    // - useNativeMedia = open the Sulu SingleMediaSelectionOverlay via postMessage
    // - useCustomAssetManager = use the GrapeJS Asset Manager with pagination/search
    const useNativeMedia = isInlinePreview || (isDetachedPreview && detachedNativeMedia);
    const useCustomAssetManager = !isPreviewMode || (isDetachedPreview && !detachedNativeMedia);

    const previewStorageKey = isPreviewMode && saveUrl
        ? `gjsPreview-${encodeURIComponent(saveUrl)}`
        : null;

    // In preview mode, recover the current editing session data
    // saved in localStorage before the Sulu re-render
    let effectiveHtml = jsonBuilderHtml;
    let effectiveCss = jsonBuilderCss;

    if (previewStorageKey) {
        try {
            const stored = JSON.parse(localStorage.getItem(previewStorageKey));
            if (stored && stored.ts && (Date.now() - stored.ts < 300000)) {
                // Check that base data hasn't changed
                // (e.g. saved via standalone builder in the meantime)
                if (stored.baseHtml === jsonBuilderHtml && stored.baseCss === jsonBuilderCss) {
                    effectiveHtml = stored.html;
                    effectiveCss = stored.css;
                } else {
                    // Backend data changed → stale cache
                    localStorage.removeItem(previewStorageKey);
                }
            }
        } catch (e) { /* ignore */ }
    }

    // Load assets when using the custom GrapeJS Asset Manager
    // (standalone mode, or detached preview with native media disabled)
    let imagesAssets = [];
    let documentsAssets = [];
    let availableFormats = [];

    if (useCustomAssetManager) {
        imagesAssets = await loadImagesAssetsFromSulu(locale, 1);
        documentsAssets = await loadDocumentsAssetsFromSulu(locale, 1);
    }

    // Load format definitions for the format selector trait (all modes)
    availableFormats = await loadImageFormats(locale);

    let projectData = {
        pages: [{
            name: 'Page 1',
            component: '',
        }],
        assets: [...imagesAssets, ...documentsAssets],
        styles: [],
    };

    if (effectiveHtml) {
        projectData.pages = [{
            name: 'Page 1',
            component: effectiveHtml,
        }];
    }

    if (effectiveCss && projectData.pages.length) {
        let component = projectData.pages[0].component || '';
        const styleTag = `<style>${effectiveCss}</style>`;
        component = component.includes('<head>')
            ? component.replace('<head>', `<head>${styleTag}`)
            : styleTag + component;
        projectData.pages[0].component = component;
    }

    // Styles and scripts to inject into the GrapeJS canvas (nested iframe).
    // In preview: <link> elements from the document (loaded by Sulu) are cloned
    // into the canvas via the load event (survives internal frame rebuilds).
    // In standalone: uses paths configured in the YAML.
    const builderAssetPatterns = ['grapesjs', 'grape-builder', 'itechworldsulugrapesjs'];
    const isBuilderAsset = (url) => builderAssetPatterns.some(p => url.includes(p));

    let canvasStyles = [];
    let canvasScripts = [];

    if (!isPreviewMode) {
        if (frontendCssPath) canvasStyles.push(frontendCssPath);
        if (frontendJsPath) canvasScripts.push(frontendJsPath);
    }

    const editor = grapesjs.init({
        container: '#sulu-page-builder',
        // Override default GrapeJS baseCss to remove background-color: #fff
        // on the body, so that frontend styles can apply normally
        baseCss: `
            * { box-sizing: border-box; }
            html, body, [data-gjs-type=wrapper] { min-height: 100%; }
            body { margin: 0; height: 100%; }
            [data-gjs-type=wrapper] { overflow: auto; overflow-x: hidden; }
            * ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); }
            * ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); }
            * ::-webkit-scrollbar { width: 10px; }
        `,
        canvas: {
            styles: canvasStyles,
            scripts: canvasScripts,
        },
        plugins: [
            editor => plugin(editor, {}),
            editor => blocksBasic(editor, {
                flexGrid: true,
            }),
            editor => bg(editor, {}),
            editor => customCode(editor, {}),
            editor => tooltip(editor, {}),
            editor => typed(editor, {}),
            editor => filter(editor, {}),
            editor => countdown(editor, {}),
            editor => tuiImageEditor(editor, {}),
            editor => grapesjsObjectFit(editor, {}),
            editor => rteExtension(editor, {}),
        ],
        assetManager: {
            upload: false,
            autoAdd: false,
            embedAsBase64: false,
            showUrlInput: false,
            assets: [...imagesAssets, ...documentsAssets],
        },
        projectData: projectData,
        // In preview mode (no save button), disable storageManager
        // to avoid auto-saves interfering with the Sulu FormStore flow
        storageManager: saveButton ? {
            type: 'local',
            options: {
                local: {
                    key: `gjsProject-1`,
                    onStore: async (data, editor) => {
                        console.log(data);
                        return save(editor, data, saveUrl);
                    },
                }
            }
        } : false,
        i18n: {
            messages: {
                de,
                fr,
            }
        }
    });

    // --- Sulu image format selector trait ---
    // Custom trait type that displays a dropdown of available Sulu image formats
    // (e.g. sulu-170x170, sulu-400x400) on image components with data-media-id.
    // Inspired by grapesjs-object-fit pattern: createInput, onUpdate, onEvent.
    editor.TraitManager.addType('sulu-format', {
        createInput({ trait }) {
            const el = document.createElement('div');
            el.className = 'gjs-field gjs-select';
            el.innerHTML = `
                <span class="gjs-input-holder">
                    <select class="sulu-format-select"></select>
                </span>
                <div class="gjs-sel-arrow"><div class="gjs-d-s-arrow"></div></div>
            `;
            return el;
        },
        onUpdate({ elInput, component }) {
            const select = elInput.querySelector('.sulu-format-select');
            if (!select) return;

            const mediaId = component.getAttributes()['data-media-id'];
            const wrapper = elInput.closest('.gjs-trt-trait__wrp');

            // Hide entirely when no Sulu media associated
            if (!mediaId) {
                if (wrapper) wrapper.style.display = 'none';
                return;
            }
            if (wrapper) wrapper.style.display = '';

            const thumbnails = component.get('mediaThumbnails') || {};
            const mediaUrl = component.get('mediaUrl') || '';
            const currentSrc = component.getAttributes().src || component.get('src') || '';

            select.innerHTML = '';

            if (Object.keys(thumbnails).length === 0) {
                // Thumbnails not loaded yet (async loading in progress)
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = t('traits.format_original');
                select.appendChild(opt);
                select.disabled = true;
                return;
            }

            select.disabled = false;

            // "Original" option = full-resolution URL
            const origOpt = document.createElement('option');
            origOpt.value = mediaUrl;
            origOpt.textContent = t('traits.format_original');
            if (currentSrc === mediaUrl) origOpt.selected = true;
            select.appendChild(origOpt);

            // Sulu format options
            Object.entries(thumbnails).forEach(([key, url]) => {
                const opt = document.createElement('option');
                opt.value = url;
                const formatInfo = availableFormats.find(f => f.key === key);
                let label = formatInfo?.title || key;
                // Append scale dimensions when available
                const scale = formatInfo?.scale;
                if (scale) {
                    if (scale.x && scale.y) {
                        label += ` (${scale.x}*${scale.y})`;
                    } else if (scale.x) {
                        label += ` (${scale.x}x)`;
                    } else if (scale.y) {
                        label += ` (${scale.y}y)`;
                    }
                }
                opt.textContent = label;
                if (currentSrc === url) opt.selected = true;
                select.appendChild(opt);
            });
        },
        onEvent({ elInput, component }) {
            const select = elInput.querySelector('.sulu-format-select');
            if (!select || select.disabled) return;
            const selectedUrl = select.value;
            if (selectedUrl) {
                component.set('src', selectedUrl);
                component.addAttributes({ src: selectedUrl });
            }
        },
    });

    // Extend the default image component to include the format selector trait
    editor.DomComponents.addType('image', {
        model: {
            defaults: {
                traits: [
                    'alt',
                    {
                        type: 'sulu-format',
                        label: t('traits.format'),
                        name: 'sulu-format',
                        changeProp: true,
                    },
                ],
            },
        },
    });

    // Lazy-load thumbnails when selecting an image loaded from saved HTML.
    // Images have data-media-id but no mediaThumbnails in memory yet.
    editor.on('component:selected', async (component) => {
        if (component.get('type') !== 'image') return;

        const mediaId = component.getAttributes()['data-media-id'];
        if (!mediaId) return;

        const existing = component.get('mediaThumbnails');
        if (existing && Object.keys(existing).length > 0) {
            // Already loaded — just refresh trait display
            component.trigger('change:sulu-format');
            return;
        }

        // Fetch media data from Sulu API
        try {
            const response = await fetch(`/admin/api/media/${mediaId}?locale=${locale}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include',
            });
            if (!response.ok) return;

            const media = await response.json();
            const thumbnails = Object.fromEntries(
                Object.entries(media.thumbnails || {}).filter(([key]) => !key.includes('.'))
            );
            component.set('mediaThumbnails', thumbnails);
            if (!component.get('mediaUrl')) {
                component.set('mediaUrl', media.url);
            }
        } catch (e) {
            // Silently fail — format selector will show as disabled
        }

        // Trigger trait re-render with loaded thumbnails
        component.trigger('change:sulu-format');
    });

    // --- Native media mode: intercept Asset Manager to use Sulu overlay via postMessage ---
    let _pendingAssetTarget = null;

    if (useNativeMedia) {
        // Override image asset manager to use Sulu's SingleMediaSelectionOverlay
        editor.Commands.add('open-assets', {
            run(editor, sender, opts = {}) {
                _pendingAssetTarget = opts.target || editor.getSelected();
                const target = getPreviewTarget();
                if (target) {
                    target.postMessage({
                        type: 'sulu-grapes-open-media',
                    }, window.location.origin);
                }
            },
            stop() {},
        });

        // Override document asset command to use Sulu's overlay
        editor.Commands.add('open-document-asset', {
            run(editor, sender, opts = {}) {
                _pendingAssetTarget = editor.getSelected();
                const target = getPreviewTarget();
                if (target) {
                    target.postMessage({
                        type: 'sulu-grapes-open-document',
                    }, window.location.origin);
                }
            },
            stop() {},
        });

        // Listen for media selection response from the Sulu admin parent
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) return;

            if (event.data?.type === 'sulu-grapes-media-selected') {
                const media = event.data.media;

                if (_pendingAssetTarget && media.type === 'image') {
                    // Image: set src on the target component
                    _pendingAssetTarget.set('src', media.url);
                    _pendingAssetTarget.addAttributes({
                        'data-media-id': String(media.id),
                        alt: media.title || '',
                    });
                    // Store thumbnails for the format selector (filter .webp variants)
                    const thumbnails = Object.fromEntries(
                        Object.entries(media.thumbnails || {}).filter(([key]) => !key.includes('.'))
                    );
                    _pendingAssetTarget.set('mediaThumbnails', thumbnails);
                    _pendingAssetTarget.set('mediaUrl', media.url);
                    // Refresh format trait
                    _pendingAssetTarget.trigger('change:sulu-format');
                } else if (_pendingAssetTarget && media.type === 'document') {
                    // Document: set href on the document-link component
                    _pendingAssetTarget.addAttributes({ href: media.url });
                    const currentText = _pendingAssetTarget.get('text');
                    if (!currentText || currentText === t('document.download')) {
                        _pendingAssetTarget.components(media.title || media.name);
                        _pendingAssetTarget.set('text', media.title || media.name);
                    }
                }
                _pendingAssetTarget = null;
                // Release the command so it can be run again
                editor.stopCommand('open-assets');
                editor.stopCommand('open-document-asset');
                onEditorChange();
            }

            if (event.data?.type === 'sulu-grapes-media-cancelled') {
                _pendingAssetTarget = null;
                // Release the command so it can be run again
                editor.stopCommand('open-assets');
                editor.stopCommand('open-document-asset');
            }
        });
    }

    // Track which asset type is currently active in the Asset Manager.
    // Set by context: 'image' by default, 'document' when open-document-asset runs.
    let _currentAssetType = 'image';

    // --- Custom asset manager mode: document asset command ---
    if (useCustomAssetManager) {
        editor.Commands.add('open-document-asset', {
            run(editor, sender, opts = {}) {
                _currentAssetType = 'document';
                editor.runCommand('open-assets', {
                    types: ['document'],
                    onSelect(asset) {
                        const selected = editor.getSelected();
                        if (selected && asset && asset.get('type') === 'document') {
                            selected.addAttributes({
                                href: asset.get('src'),
                                'data-media-id': String(asset.get('mediaId') || ''),
                            });
                            if (!selected.get('text') || selected.get('text') === t('document.download')) {
                                selected.components(asset.get('name'));
                                selected.set('text', asset.get('name'));
                                selected.set('href', asset.get('src'));
                            }
                        }
                    },
                });
                const modal = editor.Modal;
                modal.setTitle(t('document.select_modal_title'));
            },
        });
    }

    // --- Custom asset manager mode: inject data-media-id on asset selection ---
    if (useCustomAssetManager) {
        editor.on('asset:select', (asset) => {
            const selected = editor.getSelected();
            if (selected && asset.get('mediaId')) {
                selected.addAttributes({
                    'data-media-id': String(asset.get('mediaId')),
                    alt: asset.get('name') || '',
                });
                // Use original full-resolution URL as src
                selected.set('src', asset.get('mediaUrl'));
                // Store thumbnails for the format selector
                selected.set('mediaThumbnails', asset.get('mediaThumbnails') || {});
                selected.set('mediaUrl', asset.get('mediaUrl') || '');
                // Refresh format trait
                selected.trigger('change:sulu-format');
            }
        });
    }

    // --- Custom asset manager mode: pagination and search ---
    // GrapeJS handles type filtering natively via context:
    // - Image blocks open Asset Manager with types: ['image']
    // - Document blocks use open-document-asset which passes types: ['document']
    // No tabs needed — _currentAssetType tracks which type is active for pagination/search.
    if (useCustomAssetManager) {
        let _searchTimeout = null;

        /**
         * Refreshes assets of the given type in the Asset Manager.
         * Only replaces assets of the specified type, keeping the other type intact
         * so that GrapeJS native type filtering continues to work.
         *
         * @param {'image'|'document'} type - Asset type to reload
         * @param {number} page - Page number
         * @param {string} search - Search query
         */
        const refreshAssets = async (type, page, search) => {
            let newAssets;
            if (type === 'image') {
                newAssets = await loadImagesAssetsFromSulu(locale, page, search);
            } else {
                newAssets = await loadDocumentsAssetsFromSulu(locale, page, search);
            }

            const am = editor.AssetManager;

            // Remove only assets of the current type, keep the other type intact
            const toRemove = am.getAll().filter(a => a.get('type') === type);
            toRemove.forEach(a => am.remove(a));

            // Add fresh assets of the paginated type
            newAssets.forEach(a => am.add(a));

            // Force the asset manager to re-render its content
            if (typeof am.render === 'function') {
                am.render(am.getAll().toJSON());
            }

            updatePaginationUI(type);
        };

        /**
         * Updates the pagination controls in the Asset Manager UI.
         *
         * @param {'image'|'document'} type - Current asset type displayed
         */
        const updatePaginationUI = (type) => {
            const pageInfo = document.querySelector('.gjs-am-page-info');
            const prevBtn = document.querySelector('.gjs-am-prev');
            const nextBtn = document.querySelector('.gjs-am-next');

            if (!pageInfo) return;

            const currentPage = type === 'image' ? _currentImagePage : _currentDocPage;
            const totalPages = type === 'image' ? _totalImagePages : _totalDocPages;

            pageInfo.textContent = `${currentPage} / ${totalPages}`;
            if (prevBtn) prevBtn.disabled = currentPage <= 1;
            if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
        };

        editor.on('asset:open', () => {
            setTimeout(() => {
                const amContainer = document.querySelector('.gjs-am-assets');
                if (!amContainer || amContainer.parentNode.querySelector('.gjs-am-pagination')) return;

                const currentPage = _currentAssetType === 'image' ? _currentImagePage : _currentDocPage;
                const totalPages = _currentAssetType === 'image' ? _totalImagePages : _totalDocPages;
                const currentSearch = _currentAssetType === 'image' ? _imageSearchQuery : _docSearchQuery;

                // Inject search and pagination controls
                const paginationEl = document.createElement('div');
                paginationEl.className = 'gjs-am-pagination';
                paginationEl.innerHTML = `
                    <div class="gjs-am-search-row">
                        <input type="text" class="gjs-am-search" placeholder="${t('asset_manager.search')}" value="${currentSearch}" />
                    </div>
                    <div class="gjs-am-page-controls">
                        <button class="gjs-am-prev" disabled>&#9664;</button>
                        <span class="gjs-am-page-info">${currentPage} / ${totalPages}</span>
                        <button class="gjs-am-next">&#9654;</button>
                    </div>
                `;
                amContainer.parentNode.insertBefore(paginationEl, amContainer);

                const searchInput = paginationEl.querySelector('.gjs-am-search');

                // Wire up search
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(_searchTimeout);
                    _searchTimeout = setTimeout(() => {
                        const query = e.target.value.trim();
                        if (_currentAssetType === 'image') {
                            _imageSearchQuery = query;
                            refreshAssets('image', 1, query);
                        } else {
                            _docSearchQuery = query;
                            refreshAssets('document', 1, query);
                        }
                    }, 400);
                });

                // Wire up prev/next buttons
                const prevBtn = paginationEl.querySelector('.gjs-am-prev');
                const nextBtn = paginationEl.querySelector('.gjs-am-next');

                prevBtn.addEventListener('click', () => {
                    if (_currentAssetType === 'image' && _currentImagePage > 1) {
                        refreshAssets('image', _currentImagePage - 1, _imageSearchQuery);
                    } else if (_currentAssetType === 'document' && _currentDocPage > 1) {
                        refreshAssets('document', _currentDocPage - 1, _docSearchQuery);
                    }
                });

                nextBtn.addEventListener('click', () => {
                    if (_currentAssetType === 'image' && _currentImagePage < _totalImagePages) {
                        refreshAssets('image', _currentImagePage + 1, _imageSearchQuery);
                    } else if (_currentAssetType === 'document' && _currentDocPage < _totalDocPages) {
                        refreshAssets('document', _currentDocPage + 1, _docSearchQuery);
                    }
                });

                updatePaginationUI(_currentAssetType);
            }, 100);
        });

        // Reset type tracking and remove pagination controls when the Asset Manager closes
        editor.on('asset:close', () => {
            _currentAssetType = 'image';
            const paginationEl = document.querySelector('.gjs-am-pagination');
            if (paginationEl) paginationEl.remove();
        });
    }

    // Add DOCUMENT component (link or button to a file)
    editor.DomComponents.addType('document-link', {
        isComponent(el) {
            if (el.tagName === 'A' && el.classList.contains('gjs-document-link')) {
                return { type: 'document-link' };
            }
            return false;
        },
        model: {
            defaults: {
                tagName: 'a',
                draggable: true,
                droppable: false,
                attributes: { href: '#', target: '_blank', class: 'gjs-document-link' },
                traits: [
                    {
                        type: 'text',
                        label: t('traits.text'),
                        name: 'text',
                        changeProp: 1,
                    },
                    {
                        type: 'text',
                        label: t('traits.link'),
                        name: 'href',
                        placeholder: t('document.url'),
                        changeProp: 1,
                    },
                    {
                        type: 'button',
                        label: t('blocks.document'),
                        text: t('buttons.choose_document'),
                        full: true,
                        command: 'open-document-asset',
                    },
                ],
                text: '',
                tagName: 'a',
                attributes: {
                    class: 'gjs-document-link',
                    target: '_blank',
                    href: '#'
                }
            },
            init() {
                const href = this.getAttributes().href;

                if (!href || href === '#') {
                    const domHref = this.view?.el?.getAttribute('href');
                    if (domHref) {
                        this.addAttributes({ href: domHref });
                    }
                }

                this.on('change:text', this.handleTextChange);
            },
            handleTextChange() {
                this.components(this.get('text'));
            },
            toHTML() {
                const attrs = this.getAttributes();
                const attrStr = Object.entries(attrs)
                    .map(([key, value]) => ` ${key}="${value}"`)
                    .join('');
                const text = this.get('text');
                return `<a${attrStr}>${text}</a>`;
            },
        },
        view: {
            onRender() {
                const model = this.model;
                const htmlText = this.el.innerHTML.trim();
                const currentText = model.get('text');
                const href = this.el.getAttribute('href');
                const currentHref = model.get('href');

                if (htmlText && htmlText !== currentText) {
                    model.set('text', htmlText);
                } else {
                    this.el.innerHTML = currentText;
                }

                if (href && href !== currentHref) {
                    model.set('href', href);
                } else {
                    this.el.setAttribute('href', currentHref);
                }
            },
        },
    });

    // Add DOCUMENT-LINK block to the block manager
    editor.BlockManager.add('document-link', {
        label: t('blocks.document'),
        category: 'Basic',
        media: `
          <svg viewBox="0 0 24 24">
            <path fill="currentColor" d="M6 2C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2H6M13 3.5L18.5 9H14C13.45 9 13 8.55 13 8V3.5M6 4H12V8C12 9.1 12.9 10 14 10H18V20H6V4Z" />
          </svg>
        `,
        content: {
            type: 'document-link',
            content: t('document.download'),
            attributes: {
                href: '#',
            },
        },
    });

    // In preview: clone <link rel="stylesheet"> from the parent document into the
    // GrapeJS canvas. Executed on each canvas frame (re)load so that styles
    // survive internal GrapeJS rebuilds.
    // Only <link> elements are cloned (not inline <style> which may contain
    // builder or framework styles that would break the canvas).
    if (isPreviewMode) {
        const injectPreviewLinks = () => {
            const canvasDoc = editor.Canvas.getDocument();
            if (!canvasDoc) return;

            document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                if (!link.href || isBuilderAsset(link.href)) return;
                // Avoid duplicates
                if (canvasDoc.querySelector(`link[href="${link.href}"]`)) return;
                const clone = canvasDoc.createElement('link');
                clone.rel = 'stylesheet';
                clone.href = link.href;
                canvasDoc.head.appendChild(clone);
            });
        };
        // 'load' = editor fully initialized, canvas ready
        editor.on('load', injectPreviewLinks);
    }

    // Initialize anti-loop reference values
    // In preview: from the actual editor state (may come from localStorage)
    // to avoid an immediate postMessage after re-render
    if (isPreviewMode) {
        lastSentHtml = editor.getHtml();
        lastSentCss = editor.getCss();
    } else {
        lastSentHtml = jsonBuilderHtml;
        lastSentCss = jsonBuilderCss;
    }

    // Handle save button click (button does not exist in preview mode)
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const data = editor.getProjectData();
            save(editor, data, saveUrl);
            updateSaveIconState(false);
            notifyParentOfChanges(editor);
        });
    }

    if (publishButton) {
        publishButton.addEventListener('click', () => {
            publish(publishUrl);
        });
    }

    const builder = document.getElementById('sulu-page-builder');
    const header = document.querySelector('sulu-navbar');

    function adjust() {
        const offset = header?.offsetHeight ?? 73;
        const height = window.innerHeight * 0.962 - offset;
        builder.style.height = `${height}px`;
    }

    adjust();
    window.addEventListener('resize', adjust);

    // localStorage save in preview mode (to survive re-renders)
    function saveToPreviewStorage() {
        if (!previewStorageKey) return;
        try {
            localStorage.setItem(previewStorageKey, JSON.stringify({
                html: editor.getHtml(),
                css: editor.getCss(),
                baseHtml: jsonBuilderHtml,
                baseCss: jsonBuilderCss,
                ts: Date.now(),
            }));
        } catch (e) { /* quota exceeded or other - ignore */ }
    }

    // Flag to ignore events during editor initialization.
    // GrapeJS fires component:add for each component loaded from HTML,
    // which would trigger a false dirty state if processed.
    let editorReady = false;
    editor.on('load', () => { editorReady = true; });

    // Change detected: update save icon, localStorage and preview sync
    const onEditorChange = () => {
        if (!editorReady) return;
        updateSaveIconState(true);
        saveToPreviewStorage();
        if (isPreviewMode) sendPendingToParent(editor);
    };

    // component:update = property change on an existing component
    editor.on('component:update', () => {
        if (!editorReady) return;
        if (editor.getHtml() !== jsonBuilderHtml || editor.getCss() !== jsonBuilderCss) {
            updateSaveIconState(true);
        }
        saveToPreviewStorage();
        if (isPreviewMode) sendPendingToParent(editor);
    });

    // component:add / component:remove = block added or removed
    editor.on('component:add', onEditorChange);
    editor.on('component:remove', onEditorChange);

    editor.on('style:update', onEditorChange);
    editor.on('asset:update', onEditorChange);

    // In preview mode: sync with the Sulu FormStore only when the user
    // leaves the editor (blur) or presses Ctrl+S / Cmd+S.
    // This prevents unwanted preview re-renders during editing.
    if (isPreviewMode) {
        // Ctrl+S / Cmd+S: immediate sync with the Sulu FormStore
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                notifyParentOfChanges(editor);
            }
        });

        // Sync button in the preview banner
        const syncButton = document.getElementById('preview-sync');
        if (syncButton) {
            syncButton.addEventListener('click', () => {
                notifyParentOfChanges(editor);
            });
        }
    }
});

// @flow
import {action} from 'mobx';
import { translate } from 'sulu-admin-bundle/utils/Translator';
import AbstractFormToolbarAction from 'sulu-admin-bundle/views/Form/toolbarActions/AbstractFormToolbarAction';

export default class BuilderToolbarAction extends AbstractFormToolbarAction {
    constructor(resourceStore, formStore, router, options, locales) {
        super(resourceStore, formStore, router, options, locales);
        this.resourceStore = resourceStore;
        this.formStore = formStore;
    }

    getToolbarItemConfig() {
        const template = this.resourceFormStore.data.template;

        if (!template || template !== 'builder') {
            return null;
        }

        return {
            icon: 'su-magic',
            label: translate('itech_world.grapesjs.open_builder'),
            onClick: () => {
                const id = this.resourceFormStore.id;
                const locale = this.resourceFormStore.locale;
                const webspace = this.resourceFormStore.options?.webspace;

                if (!id || !locale || !webspace) {
                    console.warn('[BuilderToolbarAction] id, locale ou webspace manquant');
                    return;
                }

                const url = `/admin/page-builder/${webspace}/${locale}/${id}`;
                window.open(url, '_blank');
            },
            type: 'button',
        };
    }
}

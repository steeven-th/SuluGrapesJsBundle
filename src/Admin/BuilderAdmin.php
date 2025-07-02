<?php

declare(strict_types=1);

namespace ItechWorld\SuluGrapesJsBundle\Admin;

use Sulu\Bundle\AdminBundle\Admin\Admin;
use Sulu\Bundle\AdminBundle\Admin\View\ViewBuilderFactoryInterface;
use Sulu\Bundle\AdminBundle\Admin\View\ViewCollection;
use Sulu\Bundle\AdminBundle\Admin\View\ToolbarAction;

class BuilderAdmin extends Admin
{
    public const ORIGINAL_VIEW = 'sulu_page.page_edit_form.details';
    public const CUSTOM_VIEW = 'sulu_page.page_edit_form.details';

    public function __construct(
        private ViewBuilderFactoryInterface $viewBuilderFactory,
    ) {}

    public function configureViews(ViewCollection $viewCollection): void
    {
        $existingView = $viewCollection->get(self::ORIGINAL_VIEW);
        $existingToolbarActions = $existingView->getView()->getOption('toolbarActions');

        $existingToolbarActions[] = new ToolbarAction(
            'itech_world.grapesjs.open_builder',
            [
                'icon' => 'su-magic-wand',
                'type' => 'button',
                'onClick' => 'openBuilder'
            ]
        );
        
        $existingView->setOption('toolbarActions', $existingToolbarActions);

        $viewCollection->add($existingView);
    }
}
<?php

declare(strict_types = 1);

namespace ItechWorld\SuluGrapesJsBundle\Controller\Website;

use ItechWorld\SuluGrapesJsBundle\Controller\Admin\WebsitePreviewController;
use Symfony\Component\HttpFoundation\Request;
use Sulu\Component\Content\Compat\StructureInterface;

class PageBuilderController extends WebsitePreviewController
{
    public function indexAction(Request $request, StructureInterface $structure, $preview = false, $partial = false)
    {
        return $this->renderStructure($structure, [], $preview, $partial);
    }
}
<?php

declare(strict_types=1);

namespace ItechWorld\SuluGrapesJsBundle;

use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

class ItechWorldSuluGrapesJsBundle extends AbstractBundle
{
    public function configure(DefinitionConfigurator $definition): void
    {
        $definition->rootNode()
        ->children()
            ->scalarNode('frontend_css_path')->defaultValue('')->end()
            ->scalarNode('frontend_js_path')->defaultValue('')->end()
            ->booleanNode('enable_standalone_builder')->defaultFalse()->end()
            ->booleanNode('detached_preview_native_media')->defaultFalse()->end()
        ->end();
    }

    public function prependExtension(
        ContainerConfigurator $container,
        ContainerBuilder $builder,
    ): void {
        if ($builder->hasExtension('sulu_admin')) {
            $builder->prependExtensionConfig(
                'sulu_admin',
                [
                    'templates' => [
                        'page' => [
                            'directories' => [
                                'grapesjs_builder' => __DIR__ . '/../config/templates/pages',
                            ],
                        ],
                    ],
                ],
            );
        }
    }

    public function loadExtension(
        array $config,
        ContainerConfigurator $container,
        ContainerBuilder $builder,
    ): void {
        $container->parameters()->set('itech_world_sulu_grapesjs.frontend_css_path', $config['frontend_css_path']);
        $container->parameters()->set('itech_world_sulu_grapesjs.frontend_js_path', $config['frontend_js_path']);
        $container->parameters()->set('itech_world_sulu_grapesjs.enable_standalone_builder', $config['enable_standalone_builder']);
        $container->parameters()->set('itech_world_sulu_grapesjs.detached_preview_native_media', $config['detached_preview_native_media']);
        $container->import('../config/services.yaml');
    }
}
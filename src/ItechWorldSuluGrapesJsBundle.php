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
            ->arrayNode('images_formats')
                ->useAttributeAsKey('key')
                ->scalarPrototype()->end()
                ->defaultValue([
                    'sulu-400x400' => 'sulu-400x400',
                ])
            ->end()
        ->end();
    }

    public function prependExtension(
        ContainerConfigurator $container,
        ContainerBuilder $builder,
    ): void {
        $builder->prependExtensionConfig(
            'sulu_core',
            [
                'content' => [
                    'structure' => [
                        'paths' => [
                            'builder_page' => [
                                'path' => __DIR__ . '/../config/templates/pages',
                                'type' => 'page',
                            ],
                        ],
                    ],
                ],
            ],
        );
    }

    public function loadExtension(
        array $config,
        ContainerConfigurator $container,
        ContainerBuilder $builder,
    ): void {
        $container->parameters()->set('itech_world_sulu_grapesjs.frontend_css_path', $config['frontend_css_path']);
        $container->parameters()->set('itech_world_sulu_grapesjs.frontend_js_path', $config['frontend_js_path']);
        $container->parameters()->set('itech_world_sulu_grapesjs.images_formats', $config['images_formats']);
        $container->import('../config/services.yaml');
    }
}
import { alchemyCommand } from '../../config/alchemyDeployment'

describe('legacy Alchemy publisher', () => {
    it('requires a separate, interactive adoption command', () => {
        expect(alchemyCommand('deploy', 'production')).toEqual([
            'node',
            'node_modules/alchemy/bin/alchemy.js',
            'deploy',
            '--stage',
            'production',
            '--yes',
        ])
        expect(alchemyCommand('adopt', 'production')).toEqual([
            'node',
            'node_modules/alchemy/bin/alchemy.js',
            'deploy',
            '--stage',
            'production',
            '--adopt',
        ])
    })
})

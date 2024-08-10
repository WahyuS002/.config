local prefix = '<leader>x'

return {
    'folke/trouble.nvim',
    cmd = { 'TroubleToggle', 'Trouble' },
    keys = {
        { prefix, desc = 'Trouble' },
        { prefix .. 'X', '<cmd>TroubleToggle workspace_diagnostics<cr>', desc = 'Workspace diagnostics' },
        { prefix .. 'x', '<cmd>TroubleToggle document_diagnostics<cr>', desc = 'Document diagnostics' },
        { prefix .. 'q', '<cmd>TroubleToggle quickfix<cr>', desc = 'Quickfix' },
    },
    dependencies = { 'nvim-tree/nvim-web-devicons' },
    opts = {
        -- your configuration comes here
        -- or leave it empty to use the default settings
        -- refer to the configuration section below
    },
}

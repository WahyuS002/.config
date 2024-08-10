return {
    -- for auto close tag
    'windwp/nvim-ts-autotag',
    config = function()
        require('nvim-ts-autotag').setup {
            did_setup = true,
            enable = true,
            enable_close = false,
            enable_close_on_slash = false,

            filetypes = {
                'html',
                'javascript',
                'typescript',
                'javascriptreact',
                'typescriptreact',
                'tsx',
                'jsx',
                'markdown',
            },
        }
    end,
}

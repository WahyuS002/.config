return {
    { -- require the lua/plugins/treesitter.lua
        -- for complete functionality (language features)
        'quarto-dev/quarto-nvim',
        ft = { 'quarto' },
        dev = false,
        opts = {
            lspFeatures = {
                enabled = true,
                chunks = 'curly',
                languages = {
                    -- "r",
                    -- "julia",
                    -- "bash",
                    -- "html",
                    'python',
                },
                diagnostics = {
                    enabled = true,
                    triggers = { 'BufWritePost' },
                },
                completion = {
                    enabled = true,
                },
            },
            codeRunner = {
                enabled = false,
                default_method = nil, -- 'molten' or 'slime'
                ft_runners = {}, -- filetype to runner, ie. `{ python = "molten" }`.
                -- Takes precedence over `default_method`
                never_run = { 'yaml' }, -- filetypes which are never sent to a code runner
            },
        },
        dependencies = {
            -- for language features in code cells
            -- configured below on 'jmbuhr/otter.nvim'
            'jmbuhr/otter.nvim',
        },
    },
    {
        -- for lsp features in code cells / embedded code
        'jmbuhr/otter.nvim',
        dev = false,
        dependencies = {
            {
                'neovim/nvim-lspconfig',
                'nvim-treesitter/nvim-treesitter',
            },
        },
        opts = {
            verbose = {
                no_code_found = false,
            },
        },
    },
    {
        'jpalardy/vim-slime',
        init = function()
            vim.g.slime_target = 'neovim'
            vim.g.slime_python_ipython = 1
            vim.g.slime_dispatch_ipython_pause = 100
            vim.g.slime_cell_delimiter = '#\\s\\=%%'

            vim.cmd [[
                function! _EscapeText_quarto(text)
                  if slime#config#resolve("python_ipython") && len(split(a:text,"\n")) > 1
                    return ["%cpaste -q\n", slime#config#resolve("dispatch_ipython_pause"), a:text, "--\n"]
                  else
                    let empty_lines_pat = '\(^\|\n\)\zs\(\s*\n\+\)\+'
                    let no_empty_lines = substitute(a:text, empty_lines_pat, "", "g")
                    let dedent_pat = '\(^\|\n\)\zs'.matchstr(no_empty_lines, '^\s*')
                    let dedented_lines = substitute(no_empty_lines, dedent_pat, "", "g")
                    let except_pat = '\(elif\|else\|except\|finally\)\@!'
                    let add_eol_pat = '\n\s[^\n]\+\n\zs\ze\('.except_pat.'\S\|$\)'
                    return substitute(dedented_lines, add_eol_pat, "\n", "g")
                  end
                endfunction
            ]]
        end,
        config = function()
            vim.keymap.set({ 'n', 'i' }, '<m-cr>', function()
                vim.cmd [[ call slime#send_cell() ]]
            end, { desc = 'Send code cell to terminal' })
        end,
    },
}

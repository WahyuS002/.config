-- [[ Basic Keymaps ]]
--  See `:help vim.keymap.set()`

local opts = { noremap = true, silent = true }

-- My custom keymaps
vim.keymap.set('n', '<leader>|', '<cmd>vsplit<cr>', { desc = 'Split window vertically' })
vim.keymap.set('n', '<leader>i', ':Inspect<cr>', { desc = 'Inspect' })

-- Map j and k to gj and gk
vim.keymap.set('n', 'j', 'gj', { noremap = true, silent = true, desc = 'Move down by visual line' })
vim.keymap.set('n', 'k', 'gk', { noremap = true, silent = true, desc = 'Move up by visual line' })

-- Set comfortable motion scroll keys
vim.g.comfortable_motion_scroll_down_key = 'j'
vim.g.comfortable_motion_scroll_up_key = 'k'

-- Set highlight on search, but clear on pressing <Esc> in normal mode
vim.opt.hlsearch = true
vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')

-- Diagnostic keymaps
vim.keymap.set('n', '[d', vim.diagnostic.goto_prev, { desc = 'Go to previous [D]iagnostic message' })
vim.keymap.set('n', ']d', vim.diagnostic.goto_next, { desc = 'Go to next [D]iagnostic message' })
vim.keymap.set('n', '<C-e>', vim.diagnostic.open_float, { desc = 'Show diagnostic [E]rror messages' })
vim.keymap.set('n', '<C-q>', vim.diagnostic.setloclist, { desc = 'Open diagnostic [Q]uickfix list' })

-- Exit terminal mode in the builtin terminal with a shortcut that is a bit easier
-- for people to discover. Otherwise, you normally need to press <C-\><C-n>, which
-- is not what someone will guess without a bit more experience.
--
-- NOTE: This won't work in all terminal emulators/tmux/etc. Try your own mapping
-- or just use <C-\><C-n> to exit terminal mode
vim.keymap.set('t', '<Esc><Esc>', '<C-\\><C-n>', { desc = 'Exit terminal mode' })

-- TIP: Disable arrow keys in normal mode
vim.keymap.set('n', '<left>', '<cmd>echo "Use h to move!!"<CR>')
vim.keymap.set('n', '<right>', '<cmd>echo "Use l to move!!"<CR>')
vim.keymap.set('n', '<up>', '<cmd>echo "Use k to move!!"<CR>')
vim.keymap.set('n', '<down>', '<cmd>echo "Use j to move!!"<CR>')

-- Keybinds to make split navigation easier.
--  Use CTRL+<hjkl> to switch between windows
--
--  See `:help wincmd` for a list of all window commands
vim.keymap.set('n', '<C-h>', '<C-w><C-h>', { desc = 'Move focus to the left window' })
vim.keymap.set('n', '<C-l>', '<C-w><C-l>', { desc = 'Move focus to the right window' })
vim.keymap.set('n', '<C-j>', '<C-w><C-j>', { desc = 'Move focus to the lower window' })
vim.keymap.set('n', '<C-k>', '<C-w><C-k>', { desc = 'Move focus to the upper window' })

-- Make indent easier
vim.keymap.set('v', '<', '<gv')
vim.keymap.set('v', '>', '>gv')

-- Move text up and down
vim.keymap.set('v', '<A-j>', ':m .+1<CR>==')
vim.keymap.set('v', '<A-k>', ':m .-2<CR>==')
vim.keymap.set('v', 'p', '"_dP')

-- Navigate buffers
vim.keymap.set('n', '<S-l>', ':bnext<CR>')
vim.keymap.set('n', '<S-h>', ':bprevious<CR>')

-- Bufferline
vim.keymap.set('n', '<leader>bd', ':bdelete!<CR>')
vim.keymap.set('n', '<leader>bl', ':BufferLineCloseLeft<CR>')
vim.keymap.set('n', '<leader>br', ':BufferLineCloseRight<CR>')
vim.keymap.set('n', '<leader>bo', ':BufferLineCloseOthers<CR>')

-- LSP keymaps
vim.keymap.set('n', 'gD', '<cmd>lua vim.lsp.buf.declaration()<CR>')
vim.keymap.set('n', 'gd', '<cmd>lua vim.lsp.buf.definition()<CR>')
vim.keymap.set('n', 'K', '<cmd>lua vim.lsp.buf.hover()<CR>')
vim.keymap.set('n', 'gI', '<cmd>lua vim.lsp.buf.implementation()<CR>')
vim.keymap.set('n', 'gr', '<cmd>lua vim.lsp.buf.references()<CR>')
vim.keymap.set('n', 'gl', '<cmd>lua vim.diagnostic.open_float()<CR>')
vim.keymap.set('n', '<leader>lf', '<cmd>lua vim.lsp.buf.format{ async = true }<cr>')
vim.keymap.set('n', '<leader>li', '<cmd>LspInfo<cr>')
vim.keymap.set('n', '<leader>lI', '<cmd>LspInstallInfo<cr>')
vim.keymap.set('n', '<leader>la', '<cmd>lua vim.lsp.buf.code_action()<cr>')
vim.keymap.set('n', '<leader>lj', '<cmd>lua vim.diagnostic.goto_next({buffer=0})<cr>')
vim.keymap.set('n', '<leader>lk', '<cmd>lua vim.diagnostic.goto_prev({buffer=0})<cr>')
vim.keymap.set('n', '<leader>lr', '<cmd>lua vim.lsp.buf.rename()<cr>')
vim.keymap.set('n', '<leader>ls', '<cmd>lua vim.lsp.buf.signature_help()<CR>')
vim.keymap.set('n', '<leader>lq', '<cmd>lua vim.diagnostic.setloclist()<CR>')

-- [[ Basic Autocommands ]]
--  See `:help lua-guide-autocommands`

-- Highlight when yanking (copying) text
--  Try it with `yap` in normal mode
--  See `:help vim.highlight.on_yank()`
vim.api.nvim_create_autocmd('TextYankPost', {
    desc = 'Highlight when yanking (copying) text',
    group = vim.api.nvim_create_augroup('kickstart-highlight-yank', { clear = true }),
    callback = function()
        vim.highlight.on_yank()
    end,
})

-- Remove line numbers when opening the terminal
vim.api.nvim_create_autocmd('TermOpen', {
    desc = 'Remove line numbers when opening the terminal',
    callback = function()
        vim.wo.number = false
        vim.wo.relativenumber = false
    end,
})

-- Automatically scroll to the bottom of the ipython terminal buffer
--  This ensures that the most recent output is always visible,
--  especially when sending code from a Quarto document via vim-slime
--  and the terminal output exceeds the visible screen area.
vim.api.nvim_create_autocmd({ 'TermEnter', 'BufEnter', 'BufWinEnter' }, {
    pattern = 'term://ipython',
    callback = function()
        -- Scroll to bottom when entering terminal buffer
        vim.cmd 'normal! G'

        -- Set up autocmd for changes in this specific buffer
        local bufnr = vim.api.nvim_get_current_buf()
        vim.api.nvim_create_autocmd('TextChanged', {
            buffer = bufnr,
            callback = function()
                -- Check if cursor is not at the bottom
                local last_line = vim.api.nvim_buf_line_count(bufnr)
                local cursor_line = vim.api.nvim_win_get_cursor(0)[1]
                if cursor_line < last_line then
                    -- Scroll to bottom
                    vim.cmd 'normal! G'
                    -- Move cursor to the input line (usually the last line)
                    vim.cmd 'normal! $'
                end
            end,
        })
    end,
})

-- Quarto keymaps
vim.keymap.set('n', '<C-i>', 'i```{python}<cr>```<esc>O', { desc = '[i]nsert code chunk' })
vim.keymap.set('n', '<leader>qt', ':split term://ipython<cr>', { desc = '[Q]uarto repl terminal' })
vim.keymap.set('n', '<leader>qp', ':QuartoPreview<cr>', { desc = '[Q]uarto preview' })

-- Visual Block --
-- Move text up and down
vim.keymap.set('x', 'J', ":move '>+1<CR>gv-gv")
vim.keymap.set('x', 'K', ":move '<-2<CR>gv-gv")
vim.keymap.set('x', '<A-j>', ":move '>+1<CR>gv-gv")
vim.keymap.set('x', '<A-k>', ":move '<-2<CR>gv-gv")

-- vim: ts=2 sts=2 sw=2 et

-- [[ Setting options ]]
-- See `:help options`
-- NOTE: You can change these options as you wish!
--  For more options, you can see `:help option-list`

vim.opt.backup = false -- creates a backup file
vim.opt.clipboard = 'unnamedplus' -- allows neovim to access the system clipboard
vim.opt.cmdheight = 1 -- more space in the neovim command line for displaying messages
vim.opt.completeopt = { 'menuone', 'noselect' } -- mostly just for cmp
vim.opt.conceallevel = 0 -- so that `` is visible in markdown files
vim.opt.fileencoding = 'utf-8' -- the encoding written to a file
vim.opt.hlsearch = true -- highlight all matches on previous search pattern
vim.opt.ignorecase = true -- ignore case in search patterns
vim.opt.mouse = 'a' -- enable mouse mode, can be useful for resizing splits for example
vim.opt.pumheight = 10 -- pop up menu height
vim.opt.showmode = false -- don't show the mode, since it's already in the status line
vim.opt.showtabline = 2 -- always show tabs
vim.opt.smartcase = true -- smart case
vim.opt.smartindent = true -- make indenting smarter again
vim.opt.splitbelow = true -- force all horizontal splits to go below current window
vim.opt.splitright = true -- force all vertical splits to go to the right of current window
vim.opt.swapfile = false -- creates a swapfile
vim.opt.termguicolors = true -- set term gui colors (most terminals support this)
vim.opt.timeoutlen = 300 -- time to wait for a mapped sequence to complete (in milliseconds)
vim.opt.undofile = true -- save undo history
vim.opt.updatetime = 300 -- faster completion (4000ms default)
vim.opt.writebackup = false -- if a file is being edited by another program (or was written to file while editing with another program), it is not allowed to be edited
vim.opt.expandtab = true -- convert tabs to spaces
vim.opt.shiftwidth = 4 -- the number of spaces inserted for each indentation
vim.opt.tabstop = 8 -- Always 8 (see :h tabstop)
vim.opt.softtabstop = 4
vim.opt.cursorline = true -- highlight the current line
vim.opt.number = true -- set numbered lines
vim.opt.relativenumber = true -- set relative numbered lines
vim.opt.numberwidth = 4 -- set number column width to 2 {default 4}
vim.opt.signcolumn = 'yes' -- always show the sign column, otherwise it would shift the text each time
vim.opt.wrap = false -- display lines as one long line
vim.opt.scrolloff = 8 -- is one of my fav
vim.opt.sidescrolloff = 8
vim.opt.guifont = 'monospace:h17' -- the font used in graphical neovim applications
vim.opt.breakindent = true -- enable break indent
vim.opt.list = true -- set how neovil will display certain whitespace characters in the editor
vim.opt.listchars = { tab = '» ', trail = '·', nbsp = '␣' }
vim.opt.inccommand = 'split' -- preview substitutions oive, as you type!
vim.opt.shortmess:append 'c'
vim.opt.foldenable = true -- Enable folding
vim.opt.foldmethod = 'indent' -- Set fold method to manual
vim.opt.foldlevel = 99

-- Disable auto commenting new lines
vim.api.nvim_create_autocmd('FileType', {
    command = 'set formatoptions-=cro',
})

vim.cmd 'set whichwrap+=<,>,[,],h,l'
vim.cmd [[set iskeyword+=-]]

-- vim: ts=2 sts=2 sw=2 et

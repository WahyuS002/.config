return {
    'yuttie/comfortable-motion.vim',
    config = function()
        -- VimTeX configuration goes here, e.g.
        vim.api.nvim_set_keymap('n', '<C-d>', [[:call comfortable_motion#flick(75)<CR>]], { noremap = true, silent = true })
        vim.api.nvim_set_keymap('n', '<C-u>', [[:call comfortable_motion#flick(-75)<CR>]], { noremap = true, silent = true })
    end,
}

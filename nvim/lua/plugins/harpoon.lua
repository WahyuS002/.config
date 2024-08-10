return {
    {
        'ThePrimeagen/harpoon',
        branch = 'harpoon2',
        lazy = false,
        dependencies = { 'nvim-lua/plenary.nvim' },
        config = function()
            require('harpoon').setup {}

            local function toggle_telescope_with_harpoon(harpoon_files)
                local finder = function()
                    local paths = {}
                    for _, item in ipairs(harpoon_files.items) do
                        table.insert(paths, item.value)
                    end

                    return require('telescope.finders').new_table {
                        results = paths,
                    }
                end

                require('telescope.pickers')
                    .new({}, {
                        prompt_title = 'Harpoon',
                        finder = finder(),
                        previewer = require('telescope.config').values.file_previewer {},
                        sorter = require('telescope.config').values.generic_sorter {},
                        attach_mappings = function(prompt_bufnr, map)
                            map('i', '<C-d>', function()
                                local state = require 'telescope.actions.state'
                                local selected_entry = state.get_selected_entry()
                                local current_picker = state.get_current_picker(prompt_bufnr)

                                table.remove(harpoon_files.items, selected_entry.index)
                                current_picker:refresh(finder())
                            end)
                            return true
                        end,
                    })
                    :find()
            end
            vim.keymap.set('n', '<leader>hm', function()
                local harpoon = require 'harpoon'
                toggle_telescope_with_harpoon(harpoon:list())
            end, { desc = 'Open telescope harpoon marks' })
        end,
        opts = {
            menu = {
                width = vim.api.nvim_win_get_width(0) - 4,
            },
            settings = {
                save_on_toggle = true,
            },
        },
        keys = function()
            local keys = {
                {
                    '<leader>ha',
                    function()
                        require('harpoon'):list():add()
                    end,
                    desc = 'Add mark file using Harpoon',
                },
                {
                    '<C-q>',
                    function()
                        local harpoon = require 'harpoon'
                        harpoon.ui:toggle_quick_menu(harpoon:list())
                    end,
                    desc = 'Harpoon Quick Menu',
                },
            }

            for i = 1, 5 do
                table.insert(keys, {
                    '<leader>' .. i,
                    function()
                        require('harpoon'):list():select(i)
                    end,
                    desc = 'Harpoon to File ' .. i,
                })
            end
            return keys
        end,
    },
}

-- Cloak: menyamarkan nilai secret di file seperti .env saat live stream/screen share.
-- Toggle dengan `:CloakToggle`, atau aktif otomatis saat membuka file yang cocok.
-- See `:help cloak.nvim`
return {
    {
        'laytan/cloak.nvim',
        event = { 'BufReadPre', 'BufNewFile' },
        cmd = { 'CloakToggle', 'CloakEnable', 'CloakDisable', 'CloakPreviewLine' },
        keys = {
            { '<leader>tc', '<cmd>CloakToggle<cr>', desc = '[T]oggle [C]loak (sensor .env)' },
        },
        opts = {
            enabled = true,
            cloak_character = '*',
            -- warna highlight; samakan dengan background agar benar-benar tersamar
            highlight_group = 'Comment',
            -- sembunyikan panjang asli nilai (biar tidak ketebak)
            cloak_length = nil,
            try_all_patterns = true,
            cloak_telescope = true,
            patterns = {
                {
                    -- berlaku untuk semua varian file .env
                    file_pattern = {
                        '.env*',
                        'wrangler.toml',
                        '.dev.vars',
                        '*.env',
                        '.envrc',
                    },
                    -- samarkan semua yang ada di sebelah kanan tanda `=`
                    cloak_pattern = '=.+',
                },
            },
        },
    },
}
-- vim: ts=2 sts=2 sw=2 et

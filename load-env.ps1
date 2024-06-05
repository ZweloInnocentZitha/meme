if(Test-Path .env) {
    foreach($line in (Get-Content .env)) {
        if($line -Match '^[A-Z]') {
            $key, $val = $line.Split("=")
            New-Item -Name $key -Value $val -ItemType Variable -Path Env: -Force > $null
        }
    }
}
using './vm-linux.bicep'

param vmName = 'vm-linux'
param adminUsername = 'azureuser'
param sshPublicKeyName = 'vm-linux-ssh-key'
param vmSize = 'Standard_B1s'
param location = 'uksouth'

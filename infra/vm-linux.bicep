targetScope = 'resourceGroup'

@description('Virtual machine name')
param vmName string

@description('Admin username for the VM')
param adminUsername string

@description('Existing Azure SSH public key resource name in this resource group')
param sshPublicKeyName string

@description('VM size')
param vmSize string = 'Standard_B1s'

@description('Location for all resources')
param location string = resourceGroup().location

var cloudInitData = '''
#cloud-config
package_update: true
packages:
  - ca-certificates
  - curl
  - gnupg
  - lsb-release
runcmd:
  - [ bash, -lc, 'install -m 0755 -d /etc/apt/keyrings' ]
  - [ bash, -lc, 'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg' ]
  - [ bash, -lc, 'chmod a+r /etc/apt/keyrings/docker.gpg' ]
  - [ bash, -lc, 'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list' ]
  - [ bash, -lc, 'apt-get update' ]
  - [ bash, -lc, 'apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin' ]
  - [ bash, -lc, 'groupadd -f docker' ]
  - [ bash, -lc, 'systemctl enable docker' ]
  - [ bash, -lc, 'systemctl start docker' ]
  - [ bash, -lc, 'chgrp docker /var/run/docker.sock' ]
  - [ bash, -lc, 'chmod 660 /var/run/docker.sock' ]
  - [ bash, -lc, 'usermod -aG docker ${adminUsername}' ]
  - [ bash, -lc, 'docker --version > /var/log/docker-install.log' ]
  - [ bash, -lc, 'docker compose version >> /var/log/docker-install.log' ]
'''

// Network resources
resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${vmName}-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
  }
}

resource subnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  parent: vnet
  name: '${vmName}-subnet'
  properties: {
    addressPrefix: '10.0.1.0/24'
    networkSecurityGroup: {
      id: nsg.id
    }
  }
}

resource nsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: '${vmName}-nsg'
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowSSH'
        properties: {
          priority: 1000
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '22'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'AllowHTTP'
        properties: {
          priority: 1001
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 1002
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
    ]
  }
}

resource publicIp 'Microsoft.Network/publicIPAddresses@2024-05-01' = {
  name: '${vmName}-pip'
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    publicIPAddressVersion: 'IPv4'
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2024-05-01' = {
  name: '${vmName}-nic'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          subnet: {
            id: subnet.id
          }
          publicIPAddress: {
            id: publicIp.id
          }
        }
      }
    ]
  }
}

resource sshPublicKey 'Microsoft.Compute/sshPublicKeys@2024-07-01' existing = {
  name: sshPublicKeyName
}

// Virtual Machine
resource vm 'Microsoft.Compute/virtualMachines@2024-07-01' = {
  name: vmName
  location: location
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: '22_04-lts-gen2'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
        managedDisk: {
          storageAccountType: 'Standard_LRS'
        }
      }
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      customData: base64(cloudInitData)
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: sshPublicKey.properties.publicKey
            }
          ]
        }
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
          properties: {
            primary: true
          }
        }
      ]
    }
  }
}

// Outputs
// output vmId string = vm.id
// output vmName string = vm.name
// output publicIpAddress string = publicIp.properties.ipAddress
// output fqdnOrIpAddress string = publicIp.properties.ipAddress
// @description('SSH command to connect to the VM')
// output sshCommand string = 'ssh -i <private-key> ${adminUsername}@${publicIp.properties.ipAddress}'

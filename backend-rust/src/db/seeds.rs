use chrono::Utc;

use crate::models::*;

pub(super) struct DefaultVendor {
    id: String,
    name: String,
    backup_command: String,
    deploy_command: String,
    diff_command: String,
    ssh_port: i32,
    mac_prefixes: Vec<String>,
    vendor_class: String,
    default_template: String,
    group_names: Vec<String>,
}

pub(super) fn get_default_vendors_internal() -> Vec<DefaultVendor> {
    vec![
        DefaultVendor {
            id: "opengear".to_string(),
            name: "OpenGear".to_string(),
            backup_command: "config export".to_string(),
            deploy_command: String::new(),
            diff_command: String::new(),
            ssh_port: 22,
            mac_prefixes: vec!["00:13:C6".to_string()],
            vendor_class: "OpenGear".to_string(),
            default_template: "opengear-lighthouse".to_string(),
            group_names: vec![],
        },
        DefaultVendor {
            id: "cisco".to_string(),
            name: "Cisco".to_string(),
            backup_command: "show running-config".to_string(),
            deploy_command: "configure terminal\n{CONFIG}\nend\nwrite memory".to_string(),
            diff_command: String::new(),
            ssh_port: 22,
            mac_prefixes: vec![
                "00:00:0C".to_string(), "00:1A:2F".to_string(), "00:1B:0D".to_string(),
                "00:1C:0E".to_string(), "00:1D:45".to_string(), "00:22:55".to_string(),
                "00:26:99".to_string(), "2C:31:24".to_string(), "64:F6:9D".to_string(),
                "F8:C2:88".to_string(),
            ],
            vendor_class: "Cisco Systems, Inc.".to_string(),
            default_template: "cisco-ios".to_string(),
            group_names: vec![],
        },
        DefaultVendor {
            id: "arista".to_string(),
            name: "Arista".to_string(),
            backup_command: "show running-config".to_string(),
            deploy_command: "configure session ztp-deploy\n{CONFIG}\ncommit".to_string(),
            diff_command: "configure session ztp-diff\n{CONFIG}\nshow session-config diffs\nabort".to_string(),
            ssh_port: 22,
            mac_prefixes: vec![
                "00:1C:73".to_string(), "28:99:3A".to_string(), "44:4C:A8".to_string(),
                "50:01:00".to_string(), "74:83:C2".to_string(),
            ],
            vendor_class: "Arista Networks".to_string(),
            default_template: "arista-eos".to_string(),
            group_names: vec!["arista".to_string()],
        },
        DefaultVendor {
            id: "juniper".to_string(),
            name: "Juniper".to_string(),
            backup_command: "show configuration | display set".to_string(),
            deploy_command: "configure\n{CONFIG}\ncommit and-quit".to_string(),
            diff_command: "configure\n{CONFIG}\nshow | compare\nrollback 0\nexit".to_string(),
            ssh_port: 22,
            mac_prefixes: vec![
                "00:05:85".to_string(), "00:10:DB".to_string(), "00:12:1E".to_string(),
                "00:14:F6".to_string(), "00:17:CB".to_string(), "00:19:E2".to_string(),
                "00:21:59".to_string(), "00:23:9C".to_string(), "00:26:88".to_string(),
                "2C:6B:F5".to_string(), "3C:61:04".to_string(), "50:C7:09".to_string(),
                "78:FE:3D".to_string(), "84:B5:9C".to_string(), "AC:4B:C8".to_string(),
                "F4:B5:2F".to_string(), "F8:C0:01".to_string(),
            ],
            vendor_class: "Juniper Networks".to_string(),
            default_template: "juniper-junos".to_string(),
            group_names: vec![],
        },
        DefaultVendor {
            id: "raspberry-pi".to_string(),
            name: "Raspberry Pi".to_string(),
            backup_command: "cat /etc/network/interfaces".to_string(),
            deploy_command: String::new(),
            diff_command: String::new(),
            ssh_port: 22,
            mac_prefixes: vec![
                "B8:27:EB".to_string(), "DC:A6:32".to_string(), "E4:5F:01".to_string(),
                "D8:3A:DD".to_string(), "28:CD:C1".to_string(),
            ],
            vendor_class: "Raspberry Pi".to_string(),
            default_template: "raspberry-pi".to_string(),
            group_names: vec![],
        },
        DefaultVendor {
            id: "frr".to_string(),
            name: "FRR".to_string(),
            backup_command: "vtysh -c 'show running-config'".to_string(),
            deploy_command: "vtysh\nconfigure terminal\n{CONFIG}\nend\nwrite memory".to_string(),
            diff_command: String::new(),
            ssh_port: 22,
            mac_prefixes: vec![],
            vendor_class: "FRRouting".to_string(),
            default_template: "frr-bgp".to_string(),
            group_names: vec![],
        },
        DefaultVendor {
            id: "gobgp".to_string(),
            name: "GoBGP".to_string(),
            backup_command: "gobgp global; echo '---'; gobgp neighbor".to_string(),
            deploy_command: String::new(),
            diff_command: String::new(),
            ssh_port: 22,
            mac_prefixes: vec![],
            vendor_class: "GoBGP".to_string(),
            default_template: "gobgp-bgp".to_string(),
            group_names: vec![],
        },
        DefaultVendor {
            id: "amd".to_string(),
            name: "AMD".to_string(),
            backup_command: String::new(),
            deploy_command: String::new(),
            diff_command: String::new(),
            ssh_port: 22,
            mac_prefixes: vec![],
            vendor_class: "AMD".to_string(),
            default_template: String::new(),
            group_names: vec!["amd".to_string()],
        },
        DefaultVendor {
            id: "patch-panel".to_string(),
            name: "Patch Panel".to_string(),
            backup_command: String::new(),
            deploy_command: String::new(),
            diff_command: String::new(),
            ssh_port: 0,
            mac_prefixes: vec![],
            vendor_class: String::new(),
            default_template: String::new(),
            group_names: vec![],
        },
    ]
}

fn get_default_templates_internal() -> Vec<DefaultTemplate> {
    vec![
        DefaultTemplate {
            id: "cisco-ios".to_string(),
            name: "Cisco IOS Default".to_string(),
            description: "Basic Cisco IOS configuration with SSH and management".to_string(),
            vendor_id: "cisco".to_string(),
            content: r#"! ZTP Configuration for {{Hostname}}
! Generated by ZTP Server
! MAC: {{MAC}}
! IP: {{IP}}
!
hostname {{Hostname}}
!
no ip domain-lookup
ip domain-name local
!
interface Vlan1
 description Management Interface
 ip address {{IP}} {{Subnet}}
 no shutdown
!
ip default-gateway {{Gateway}}
!
username admin privilege 15 secret admin
!
line console 0
 logging synchronous
!
line vty 0 4
 login local
 transport input ssh
 exec-timeout 30 0
!
crypto key generate rsa modulus 2048
ip ssh version 2
!
end"#.to_string(),
        },
        DefaultTemplate {
            id: "arista-eos".to_string(),
            name: "Arista EOS Default".to_string(),
            description: "Basic Arista EOS configuration with SSH and management".to_string(),
            vendor_id: "arista".to_string(),
            content: r#"! ZTP Configuration for {{Hostname}}
! Generated by ZTP Server
! MAC: {{MAC}}
! IP: {{IP}}
!
hostname {{Hostname}}
!
username admin privilege 15 role network-admin secret admin
!
interface Management1
   description Management Interface
   ip address {{IP}}/24
   no shutdown
!
ip route 0.0.0.0/0 {{Gateway}}
!
management api http-commands
   protocol https
   no shutdown
!
management ssh
   idle-timeout 30
   no shutdown
!
{% include "role" %}
end"#.to_string(),
        },
        DefaultTemplate {
            id: "arista-eos-spine".to_string(),
            name: "Arista EOS Spine".to_string(),
            description: "CLOS spine role config with BGP underlay using device variables".to_string(),
            vendor_id: "arista".to_string(),
            content: r#"{% if vars.ASN is defined %}! ---- Spine Role Configuration ----
!
spanning-tree mode none
!
interface Loopback0
   ip address {{vars.Loopback}}/32
!
{% if vars.Peer1 is defined %}interface Ethernet1
   description to-{{vars.Peer1Name | default(value="leaf-1")}}-link1
   no switchport
   ip address {{vars.Peer1Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer2 is defined %}interface Ethernet2
   description to-{{vars.Peer2Name | default(value="leaf-1")}}-link2
   no switchport
   ip address {{vars.Peer2Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer3 is defined %}interface Ethernet3
   description to-{{vars.Peer3Name | default(value="leaf-2")}}-link1
   no switchport
   ip address {{vars.Peer3Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer4 is defined %}interface Ethernet4
   description to-{{vars.Peer4Name | default(value="leaf-2")}}-link2
   no switchport
   ip address {{vars.Peer4Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer5 is defined %}interface Ethernet5
   description to-{{vars.Peer5Name | default(value="leaf-3")}}-link1
   no switchport
   ip address {{vars.Peer5Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer6 is defined %}interface Ethernet6
   description to-{{vars.Peer6Name | default(value="leaf-3")}}-link2
   no switchport
   ip address {{vars.Peer6Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer7 is defined %}interface Ethernet7
   description to-{{vars.Peer7Name | default(value="leaf-4")}}-link1
   no switchport
   ip address {{vars.Peer7Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer8 is defined %}interface Ethernet8
   description to-{{vars.Peer8Name | default(value="leaf-4")}}-link2
   no switchport
   ip address {{vars.Peer8Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer9 is defined %}interface Ethernet9
   description to-{{vars.Peer9Name | default(value="leaf-5")}}-link1
   no switchport
   ip address {{vars.Peer9Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer10 is defined %}interface Ethernet10
   description to-{{vars.Peer10Name | default(value="leaf-5")}}-link2
   no switchport
   ip address {{vars.Peer10Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer11 is defined %}interface Ethernet11
   description to-{{vars.Peer11Name | default(value="leaf-6")}}-link1
   no switchport
   ip address {{vars.Peer11Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer12 is defined %}interface Ethernet12
   description to-{{vars.Peer12Name | default(value="leaf-6")}}-link2
   no switchport
   ip address {{vars.Peer12Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer13 is defined %}interface Ethernet13
   description to-{{vars.Peer13Name | default(value="leaf-7")}}-link1
   no switchport
   ip address {{vars.Peer13Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer14 is defined %}interface Ethernet14
   description to-{{vars.Peer14Name | default(value="leaf-7")}}-link2
   no switchport
   ip address {{vars.Peer14Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer15 is defined %}interface Ethernet15
   description to-{{vars.Peer15Name | default(value="leaf-8")}}-link1
   no switchport
   ip address {{vars.Peer15Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer16 is defined %}interface Ethernet16
   description to-{{vars.Peer16Name | default(value="leaf-8")}}-link2
   no switchport
   ip address {{vars.Peer16Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer17 is defined %}interface Ethernet17
   description to-{{vars.Peer17Name | default(value="leaf-9")}}-link1
   no switchport
   ip address {{vars.Peer17Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer18 is defined %}interface Ethernet18
   description to-{{vars.Peer18Name | default(value="leaf-9")}}-link2
   no switchport
   ip address {{vars.Peer18Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer19 is defined %}interface Ethernet19
   description to-{{vars.Peer19Name | default(value="leaf-10")}}-link1
   no switchport
   ip address {{vars.Peer19Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer20 is defined %}interface Ethernet20
   description to-{{vars.Peer20Name | default(value="leaf-10")}}-link2
   no switchport
   ip address {{vars.Peer20Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer21 is defined %}interface Ethernet21
   description to-{{vars.Peer21Name | default(value="leaf-11")}}-link1
   no switchport
   ip address {{vars.Peer21Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer22 is defined %}interface Ethernet22
   description to-{{vars.Peer22Name | default(value="leaf-11")}}-link2
   no switchport
   ip address {{vars.Peer22Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}
! ---- Uplink Interfaces (last 1/3 of ports — external connectivity) ----
!
{% if vars.Peer23 is defined %}interface Ethernet23
   description uplink-to-{{vars.Peer23Name | default(value="external-1")}}-link1
   no switchport
   ip address {{vars.Peer23Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer24 is defined %}interface Ethernet24
   description uplink-to-{{vars.Peer24Name | default(value="external-1")}}-link2
   no switchport
   ip address {{vars.Peer24Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer25 is defined %}interface Ethernet25
   description uplink-to-{{vars.Peer25Name | default(value="external-2")}}-link1
   no switchport
   ip address {{vars.Peer25Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer26 is defined %}interface Ethernet26
   description uplink-to-{{vars.Peer26Name | default(value="external-2")}}-link2
   no switchport
   ip address {{vars.Peer26Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer27 is defined %}interface Ethernet27
   description uplink-to-{{vars.Peer27Name | default(value="external-3")}}-link1
   no switchport
   ip address {{vars.Peer27Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer28 is defined %}interface Ethernet28
   description uplink-to-{{vars.Peer28Name | default(value="external-3")}}-link2
   no switchport
   ip address {{vars.Peer28Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer29 is defined %}interface Ethernet29
   description uplink-to-{{vars.Peer29Name | default(value="external-4")}}-link1
   no switchport
   ip address {{vars.Peer29Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer30 is defined %}interface Ethernet30
   description uplink-to-{{vars.Peer30Name | default(value="external-4")}}-link2
   no switchport
   ip address {{vars.Peer30Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer31 is defined %}interface Ethernet31
   description uplink-to-{{vars.Peer31Name | default(value="external-5")}}-link1
   no switchport
   ip address {{vars.Peer31Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer32 is defined %}interface Ethernet32
   description uplink-to-{{vars.Peer32Name | default(value="external-5")}}-link2
   no switchport
   ip address {{vars.Peer32Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}
ip routing
!
router bgp {{vars.ASN}}
   router-id {{vars.Loopback}}
   no bgp default ipv4-unicast
   maximum-paths 32 ecmp 32
   neighbor LEAFS peer group
   neighbor LEAFS send-community extended
   neighbor UPLINKS peer group
   neighbor UPLINKS send-community extended
{% if vars.Peer1 is defined %}   neighbor {{vars.Peer1}} peer group LEAFS
   neighbor {{vars.Peer1}} remote-as {{vars.Peer1ASN}}
   neighbor {{vars.Peer1}} description {{vars.Peer1Name | default(value="leaf-1")}}
{% endif %}{% if vars.Peer2 is defined %}   neighbor {{vars.Peer2}} peer group LEAFS
   neighbor {{vars.Peer2}} remote-as {{vars.Peer2ASN}}
   neighbor {{vars.Peer2}} description {{vars.Peer2Name | default(value="leaf-1")}}
{% endif %}{% if vars.Peer3 is defined %}   neighbor {{vars.Peer3}} peer group LEAFS
   neighbor {{vars.Peer3}} remote-as {{vars.Peer3ASN}}
   neighbor {{vars.Peer3}} description {{vars.Peer3Name | default(value="leaf-2")}}
{% endif %}{% if vars.Peer4 is defined %}   neighbor {{vars.Peer4}} peer group LEAFS
   neighbor {{vars.Peer4}} remote-as {{vars.Peer4ASN}}
   neighbor {{vars.Peer4}} description {{vars.Peer4Name | default(value="leaf-2")}}
{% endif %}{% if vars.Peer5 is defined %}   neighbor {{vars.Peer5}} peer group LEAFS
   neighbor {{vars.Peer5}} remote-as {{vars.Peer5ASN}}
   neighbor {{vars.Peer5}} description {{vars.Peer5Name | default(value="leaf-3")}}
{% endif %}{% if vars.Peer6 is defined %}   neighbor {{vars.Peer6}} peer group LEAFS
   neighbor {{vars.Peer6}} remote-as {{vars.Peer6ASN}}
   neighbor {{vars.Peer6}} description {{vars.Peer6Name | default(value="leaf-3")}}
{% endif %}{% if vars.Peer7 is defined %}   neighbor {{vars.Peer7}} peer group LEAFS
   neighbor {{vars.Peer7}} remote-as {{vars.Peer7ASN}}
   neighbor {{vars.Peer7}} description {{vars.Peer7Name | default(value="leaf-4")}}
{% endif %}{% if vars.Peer8 is defined %}   neighbor {{vars.Peer8}} peer group LEAFS
   neighbor {{vars.Peer8}} remote-as {{vars.Peer8ASN}}
   neighbor {{vars.Peer8}} description {{vars.Peer8Name | default(value="leaf-4")}}
{% endif %}{% if vars.Peer9 is defined %}   neighbor {{vars.Peer9}} peer group LEAFS
   neighbor {{vars.Peer9}} remote-as {{vars.Peer9ASN}}
   neighbor {{vars.Peer9}} description {{vars.Peer9Name | default(value="leaf-5")}}
{% endif %}{% if vars.Peer10 is defined %}   neighbor {{vars.Peer10}} peer group LEAFS
   neighbor {{vars.Peer10}} remote-as {{vars.Peer10ASN}}
   neighbor {{vars.Peer10}} description {{vars.Peer10Name | default(value="leaf-5")}}
{% endif %}{% if vars.Peer11 is defined %}   neighbor {{vars.Peer11}} peer group LEAFS
   neighbor {{vars.Peer11}} remote-as {{vars.Peer11ASN}}
   neighbor {{vars.Peer11}} description {{vars.Peer11Name | default(value="leaf-6")}}
{% endif %}{% if vars.Peer12 is defined %}   neighbor {{vars.Peer12}} peer group LEAFS
   neighbor {{vars.Peer12}} remote-as {{vars.Peer12ASN}}
   neighbor {{vars.Peer12}} description {{vars.Peer12Name | default(value="leaf-6")}}
{% endif %}{% if vars.Peer13 is defined %}   neighbor {{vars.Peer13}} peer group LEAFS
   neighbor {{vars.Peer13}} remote-as {{vars.Peer13ASN}}
   neighbor {{vars.Peer13}} description {{vars.Peer13Name | default(value="leaf-7")}}
{% endif %}{% if vars.Peer14 is defined %}   neighbor {{vars.Peer14}} peer group LEAFS
   neighbor {{vars.Peer14}} remote-as {{vars.Peer14ASN}}
   neighbor {{vars.Peer14}} description {{vars.Peer14Name | default(value="leaf-7")}}
{% endif %}{% if vars.Peer15 is defined %}   neighbor {{vars.Peer15}} peer group LEAFS
   neighbor {{vars.Peer15}} remote-as {{vars.Peer15ASN}}
   neighbor {{vars.Peer15}} description {{vars.Peer15Name | default(value="leaf-8")}}
{% endif %}{% if vars.Peer16 is defined %}   neighbor {{vars.Peer16}} peer group LEAFS
   neighbor {{vars.Peer16}} remote-as {{vars.Peer16ASN}}
   neighbor {{vars.Peer16}} description {{vars.Peer16Name | default(value="leaf-8")}}
{% endif %}{% if vars.Peer17 is defined %}   neighbor {{vars.Peer17}} peer group LEAFS
   neighbor {{vars.Peer17}} remote-as {{vars.Peer17ASN}}
   neighbor {{vars.Peer17}} description {{vars.Peer17Name | default(value="leaf-9")}}
{% endif %}{% if vars.Peer18 is defined %}   neighbor {{vars.Peer18}} peer group LEAFS
   neighbor {{vars.Peer18}} remote-as {{vars.Peer18ASN}}
   neighbor {{vars.Peer18}} description {{vars.Peer18Name | default(value="leaf-9")}}
{% endif %}{% if vars.Peer19 is defined %}   neighbor {{vars.Peer19}} peer group LEAFS
   neighbor {{vars.Peer19}} remote-as {{vars.Peer19ASN}}
   neighbor {{vars.Peer19}} description {{vars.Peer19Name | default(value="leaf-10")}}
{% endif %}{% if vars.Peer20 is defined %}   neighbor {{vars.Peer20}} peer group LEAFS
   neighbor {{vars.Peer20}} remote-as {{vars.Peer20ASN}}
   neighbor {{vars.Peer20}} description {{vars.Peer20Name | default(value="leaf-10")}}
{% endif %}{% if vars.Peer21 is defined %}   neighbor {{vars.Peer21}} peer group LEAFS
   neighbor {{vars.Peer21}} remote-as {{vars.Peer21ASN}}
   neighbor {{vars.Peer21}} description {{vars.Peer21Name | default(value="leaf-11")}}
{% endif %}{% if vars.Peer22 is defined %}   neighbor {{vars.Peer22}} peer group LEAFS
   neighbor {{vars.Peer22}} remote-as {{vars.Peer22ASN}}
   neighbor {{vars.Peer22}} description {{vars.Peer22Name | default(value="leaf-11")}}
{% endif %}{% if vars.Peer23 is defined %}   neighbor {{vars.Peer23}} peer group UPLINKS
   neighbor {{vars.Peer23}} remote-as {{vars.Peer23ASN}}
   neighbor {{vars.Peer23}} description {{vars.Peer23Name | default(value="external-1")}}
{% endif %}{% if vars.Peer24 is defined %}   neighbor {{vars.Peer24}} peer group UPLINKS
   neighbor {{vars.Peer24}} remote-as {{vars.Peer24ASN}}
   neighbor {{vars.Peer24}} description {{vars.Peer24Name | default(value="external-1")}}
{% endif %}{% if vars.Peer25 is defined %}   neighbor {{vars.Peer25}} peer group UPLINKS
   neighbor {{vars.Peer25}} remote-as {{vars.Peer25ASN}}
   neighbor {{vars.Peer25}} description {{vars.Peer25Name | default(value="external-2")}}
{% endif %}{% if vars.Peer26 is defined %}   neighbor {{vars.Peer26}} peer group UPLINKS
   neighbor {{vars.Peer26}} remote-as {{vars.Peer26ASN}}
   neighbor {{vars.Peer26}} description {{vars.Peer26Name | default(value="external-2")}}
{% endif %}{% if vars.Peer27 is defined %}   neighbor {{vars.Peer27}} peer group UPLINKS
   neighbor {{vars.Peer27}} remote-as {{vars.Peer27ASN}}
   neighbor {{vars.Peer27}} description {{vars.Peer27Name | default(value="external-3")}}
{% endif %}{% if vars.Peer28 is defined %}   neighbor {{vars.Peer28}} peer group UPLINKS
   neighbor {{vars.Peer28}} remote-as {{vars.Peer28ASN}}
   neighbor {{vars.Peer28}} description {{vars.Peer28Name | default(value="external-3")}}
{% endif %}{% if vars.Peer29 is defined %}   neighbor {{vars.Peer29}} peer group UPLINKS
   neighbor {{vars.Peer29}} remote-as {{vars.Peer29ASN}}
   neighbor {{vars.Peer29}} description {{vars.Peer29Name | default(value="external-4")}}
{% endif %}{% if vars.Peer30 is defined %}   neighbor {{vars.Peer30}} peer group UPLINKS
   neighbor {{vars.Peer30}} remote-as {{vars.Peer30ASN}}
   neighbor {{vars.Peer30}} description {{vars.Peer30Name | default(value="external-4")}}
{% endif %}{% if vars.Peer31 is defined %}   neighbor {{vars.Peer31}} peer group UPLINKS
   neighbor {{vars.Peer31}} remote-as {{vars.Peer31ASN}}
   neighbor {{vars.Peer31}} description {{vars.Peer31Name | default(value="external-5")}}
{% endif %}{% if vars.Peer32 is defined %}   neighbor {{vars.Peer32}} peer group UPLINKS
   neighbor {{vars.Peer32}} remote-as {{vars.Peer32ASN}}
   neighbor {{vars.Peer32}} description {{vars.Peer32Name | default(value="external-5")}}
{% endif %}
   !
   address-family ipv4 unicast
      neighbor LEAFS activate
      neighbor UPLINKS activate
      redistribute connected
!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "arista-eos-leaf".to_string(),
            name: "Arista EOS Leaf".to_string(),
            description: "CLOS leaf role config with BGP underlay and VXLAN using device variables".to_string(),
            vendor_id: "arista".to_string(),
            content: r#"{% if vars.ASN is defined %}! ---- Leaf Role Configuration ----
!
spanning-tree mode mstp
!
vlan 10
   name Servers
!
vlan 20
   name Storage
!
{% for vrf in VRFs %}vrf instance {{vrf.name}}
   rd {{vrf.name}}:{{vrf.id}}
!
{% endfor %}interface Loopback0
   ip address {{vars.Loopback}}/32
!
{% if vars.Peer49 is defined %}interface Ethernet49
   description uplink-to-{{vars.Peer49Name | default(value="spine-1")}}-link1
   no switchport
   ip address {{vars.Peer49Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer50 is defined %}interface Ethernet50
   description uplink-to-{{vars.Peer50Name | default(value="spine-1")}}-link2
   no switchport
   ip address {{vars.Peer50Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer51 is defined %}interface Ethernet51
   description uplink-to-{{vars.Peer51Name | default(value="spine-2")}}-link1
   no switchport
   ip address {{vars.Peer51Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer52 is defined %}interface Ethernet52
   description uplink-to-{{vars.Peer52Name | default(value="spine-2")}}-link2
   no switchport
   ip address {{vars.Peer52Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer53 is defined %}interface Ethernet53
   description uplink-to-{{vars.Peer53Name | default(value="spine-3")}}-link1
   no switchport
   ip address {{vars.Peer53Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer54 is defined %}interface Ethernet54
   description uplink-to-{{vars.Peer54Name | default(value="spine-3")}}-link2
   no switchport
   ip address {{vars.Peer54Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer55 is defined %}interface Ethernet55
   description uplink-to-{{vars.Peer55Name | default(value="spine-4")}}-link1
   no switchport
   ip address {{vars.Peer55Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer56 is defined %}interface Ethernet56
   description uplink-to-{{vars.Peer56Name | default(value="spine-4")}}-link2
   no switchport
   ip address {{vars.Peer56Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% for vrf in VRFs %}{% for iface in vrf.interfaces %}interface {{iface.port_name}}
   description {{iface.description}}
   no switchport
   vrf {{vrf.name}}
   mtu 9214
   no shutdown
!
{% endfor %}{% endfor %}
interface Vxlan1
   vxlan source-interface Loopback0
   vxlan udp-port 4789
   vxlan vlan 10 vni 10010
   vxlan vlan 20 vni 10020
!
ip routing
{% for vrf in VRFs %}ip routing vrf {{vrf.name}}
{% endfor %}!
router bgp {{vars.ASN}}
   router-id {{vars.Loopback}}
   no bgp default ipv4-unicast
   maximum-paths 8 ecmp 8
   neighbor SPINES peer group
   neighbor SPINES send-community extended
{% if vars.Peer49 is defined %}   neighbor {{vars.Peer49}} peer group SPINES
   neighbor {{vars.Peer49}} remote-as {{vars.Peer49ASN}}
   neighbor {{vars.Peer49}} description {{vars.Peer49Name | default(value="spine-1")}}
{% endif %}{% if vars.Peer50 is defined %}   neighbor {{vars.Peer50}} peer group SPINES
   neighbor {{vars.Peer50}} remote-as {{vars.Peer50ASN}}
   neighbor {{vars.Peer50}} description {{vars.Peer50Name | default(value="spine-1")}}
{% endif %}{% if vars.Peer51 is defined %}   neighbor {{vars.Peer51}} peer group SPINES
   neighbor {{vars.Peer51}} remote-as {{vars.Peer51ASN}}
   neighbor {{vars.Peer51}} description {{vars.Peer51Name | default(value="spine-2")}}
{% endif %}{% if vars.Peer52 is defined %}   neighbor {{vars.Peer52}} peer group SPINES
   neighbor {{vars.Peer52}} remote-as {{vars.Peer52ASN}}
   neighbor {{vars.Peer52}} description {{vars.Peer52Name | default(value="spine-2")}}
{% endif %}{% if vars.Peer53 is defined %}   neighbor {{vars.Peer53}} peer group SPINES
   neighbor {{vars.Peer53}} remote-as {{vars.Peer53ASN}}
   neighbor {{vars.Peer53}} description {{vars.Peer53Name | default(value="spine-3")}}
{% endif %}{% if vars.Peer54 is defined %}   neighbor {{vars.Peer54}} peer group SPINES
   neighbor {{vars.Peer54}} remote-as {{vars.Peer54ASN}}
   neighbor {{vars.Peer54}} description {{vars.Peer54Name | default(value="spine-3")}}
{% endif %}{% if vars.Peer55 is defined %}   neighbor {{vars.Peer55}} peer group SPINES
   neighbor {{vars.Peer55}} remote-as {{vars.Peer55ASN}}
   neighbor {{vars.Peer55}} description {{vars.Peer55Name | default(value="spine-4")}}
{% endif %}{% if vars.Peer56 is defined %}   neighbor {{vars.Peer56}} peer group SPINES
   neighbor {{vars.Peer56}} remote-as {{vars.Peer56ASN}}
   neighbor {{vars.Peer56}} description {{vars.Peer56Name | default(value="spine-4")}}
{% endif %}
   !
   address-family ipv4 unicast
      neighbor SPINES activate
      redistribute connected
   !
   address-family evpn
      neighbor SPINES activate
   !
   vlan 10
      rd auto
      route-target both 10:10010
      redistribute learned
   !
   vlan 20
      rd auto
      route-target both 20:10020
      redistribute learned
{% for vrf in VRFs %}   !
   vrf {{vrf.name}}
      rd {{vrf.name}}:{{vrf.id}}
      route-target import evpn {{vrf.name}}:{{vrf.id}}
      route-target export evpn {{vrf.name}}:{{vrf.id}}
      redistribute connected
{% endfor %}!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "juniper-junos".to_string(),
            name: "Juniper Junos Default".to_string(),
            description: "Basic Juniper Junos configuration with SSH and management".to_string(),
            vendor_id: "juniper".to_string(),
            content: r#"## ZTP Configuration for {{Hostname}}
## Generated by ZTP Server
## MAC: {{MAC}}
## IP: {{IP}}

system {
    host-name {{Hostname}};
    root-authentication {
        encrypted-password "$6$admin";
    }
    login {
        user admin {
            uid 2000;
            class super-user;
            authentication {
                encrypted-password "$6$admin";
            }
        }
    }
    services {
        ssh {
            root-login allow;
        }
        netconf {
            ssh;
        }
    }
}

interfaces {
    em0 {
        unit 0 {
            family inet {
                address {{IP}}/24;
            }
        }
    }
}

routing-options {
    static {
        route 0.0.0.0/0 next-hop {{Gateway}};
    }
}"#.to_string(),
        },
        DefaultTemplate {
            id: "opengear-lighthouse".to_string(),
            name: "OpenGear Lighthouse Enrollment".to_string(),
            description: "OpenGear OM device configuration for Lighthouse enrollment".to_string(),
            vendor_id: "opengear".to_string(),
            content: r#"# ZTP Configuration for {{Hostname}}
# Generated by ZTP Server
# MAC: {{MAC}}
# IP: {{IP}}

config.system.name={{Hostname}}
config.interfaces.wan.mode=static
config.interfaces.wan.address={{IP}}
config.interfaces.wan.netmask={{Subnet}}
config.interfaces.wan.gateway={{Gateway}}

# SSH access
config.services.ssh.enable=on

# Web interface
config.services.webui.enable=on"#.to_string(),
        },
        DefaultTemplate {
            id: "frr-bgp".to_string(),
            name: "FRR BGP Default".to_string(),
            description: "FRRouting configuration with BGP and management interface".to_string(),
            vendor_id: "frr".to_string(),
            content: r#"! ZTP Configuration for {{Hostname}}
! Generated by ZTP Server
! MAC: {{MAC}}
! IP: {{IP}}
!
frr defaults traditional
hostname {{Hostname}}
log syslog informational
service integrated-vtysh-config
!
interface eth0
 description Management Interface
 ip address {{IP}}/24
!
ip route 0.0.0.0/0 {{Gateway}}
!
{% include "role" %}
end"#.to_string(),
        },
        DefaultTemplate {
            id: "frr-bgp-spine".to_string(),
            name: "FRR BGP Spine".to_string(),
            description: "FRR spine role with BGP peering to leaves via /31 point-to-point links".to_string(),
            vendor_id: "frr".to_string(),
            content: r#"{% if vars.ASN is defined %}\! ---- Spine Role Configuration ----
\!
interface lo
 ip address {{vars.Loopback}}/32
\!
{% if vars.Peer1 is defined %}interface eth1
 description to-{{vars.Peer1Name | default(value="leaf-1")}}-link1
 ip address {{vars.Peer1Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer2 is defined %}interface eth2
 description to-{{vars.Peer2Name | default(value="leaf-1")}}-link2
 ip address {{vars.Peer2Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer3 is defined %}interface eth3
 description to-{{vars.Peer3Name | default(value="leaf-2")}}-link1
 ip address {{vars.Peer3Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer4 is defined %}interface eth4
 description to-{{vars.Peer4Name | default(value="leaf-2")}}-link2
 ip address {{vars.Peer4Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer5 is defined %}interface eth5
 description to-{{vars.Peer5Name | default(value="leaf-3")}}-link1
 ip address {{vars.Peer5Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer6 is defined %}interface eth6
 description to-{{vars.Peer6Name | default(value="leaf-3")}}-link2
 ip address {{vars.Peer6Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer7 is defined %}interface eth7
 description to-{{vars.Peer7Name | default(value="leaf-4")}}-link1
 ip address {{vars.Peer7Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer8 is defined %}interface eth8
 description to-{{vars.Peer8Name | default(value="leaf-4")}}-link2
 ip address {{vars.Peer8Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer9 is defined %}interface eth9
 description to-{{vars.Peer9Name | default(value="leaf-5")}}-link1
 ip address {{vars.Peer9Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer10 is defined %}interface eth10
 description to-{{vars.Peer10Name | default(value="leaf-5")}}-link2
 ip address {{vars.Peer10Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer11 is defined %}interface eth11
 description to-{{vars.Peer11Name | default(value="leaf-6")}}-link1
 ip address {{vars.Peer11Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer12 is defined %}interface eth12
 description to-{{vars.Peer12Name | default(value="leaf-6")}}-link2
 ip address {{vars.Peer12Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer13 is defined %}interface eth13
 description to-{{vars.Peer13Name | default(value="leaf-7")}}-link1
 ip address {{vars.Peer13Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer14 is defined %}interface eth14
 description to-{{vars.Peer14Name | default(value="leaf-7")}}-link2
 ip address {{vars.Peer14Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer15 is defined %}interface eth15
 description to-{{vars.Peer15Name | default(value="leaf-8")}}-link1
 ip address {{vars.Peer15Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer16 is defined %}interface eth16
 description to-{{vars.Peer16Name | default(value="leaf-8")}}-link2
 ip address {{vars.Peer16Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer17 is defined %}interface eth17
 description to-{{vars.Peer17Name | default(value="leaf-9")}}-link1
 ip address {{vars.Peer17Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer18 is defined %}interface eth18
 description to-{{vars.Peer18Name | default(value="leaf-9")}}-link2
 ip address {{vars.Peer18Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer19 is defined %}interface eth19
 description to-{{vars.Peer19Name | default(value="leaf-10")}}-link1
 ip address {{vars.Peer19Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer20 is defined %}interface eth20
 description to-{{vars.Peer20Name | default(value="leaf-10")}}-link2
 ip address {{vars.Peer20Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer21 is defined %}interface eth21
 description to-{{vars.Peer21Name | default(value="leaf-11")}}-link1
 ip address {{vars.Peer21Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer22 is defined %}interface eth22
 description to-{{vars.Peer22Name | default(value="leaf-11")}}-link2
 ip address {{vars.Peer22Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer23 is defined %}interface eth23
 description uplink-to-{{vars.Peer23Name | default(value="external-1")}}-link1
 ip address {{vars.Peer23Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer24 is defined %}interface eth24
 description uplink-to-{{vars.Peer24Name | default(value="external-1")}}-link2
 ip address {{vars.Peer24Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer25 is defined %}interface eth25
 description uplink-to-{{vars.Peer25Name | default(value="external-2")}}-link1
 ip address {{vars.Peer25Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer26 is defined %}interface eth26
 description uplink-to-{{vars.Peer26Name | default(value="external-2")}}-link2
 ip address {{vars.Peer26Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer27 is defined %}interface eth27
 description uplink-to-{{vars.Peer27Name | default(value="external-3")}}-link1
 ip address {{vars.Peer27Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer28 is defined %}interface eth28
 description uplink-to-{{vars.Peer28Name | default(value="external-3")}}-link2
 ip address {{vars.Peer28Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer29 is defined %}interface eth29
 description uplink-to-{{vars.Peer29Name | default(value="external-4")}}-link1
 ip address {{vars.Peer29Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer30 is defined %}interface eth30
 description uplink-to-{{vars.Peer30Name | default(value="external-4")}}-link2
 ip address {{vars.Peer30Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer31 is defined %}interface eth31
 description uplink-to-{{vars.Peer31Name | default(value="external-5")}}-link1
 ip address {{vars.Peer31Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer32 is defined %}interface eth32
 description uplink-to-{{vars.Peer32Name | default(value="external-5")}}-link2
 ip address {{vars.Peer32Addr}}/31
 no shutdown
\!
{% endif %}
router bgp {{vars.ASN}}
 bgp router-id {{vars.Loopback}}
 no bgp ebgp-requires-policy
 no bgp network import-check
{% if vars.Peer1 is defined %} neighbor {{vars.Peer1}} remote-as {{vars.Peer1ASN}}
 neighbor {{vars.Peer1}} description {{vars.Peer1Name | default(value="leaf-1")}}
{% endif %}{% if vars.Peer2 is defined %} neighbor {{vars.Peer2}} remote-as {{vars.Peer2ASN}}
 neighbor {{vars.Peer2}} description {{vars.Peer2Name | default(value="leaf-1")}}
{% endif %}{% if vars.Peer3 is defined %} neighbor {{vars.Peer3}} remote-as {{vars.Peer3ASN}}
 neighbor {{vars.Peer3}} description {{vars.Peer3Name | default(value="leaf-2")}}
{% endif %}{% if vars.Peer4 is defined %} neighbor {{vars.Peer4}} remote-as {{vars.Peer4ASN}}
 neighbor {{vars.Peer4}} description {{vars.Peer4Name | default(value="leaf-2")}}
{% endif %}{% if vars.Peer5 is defined %} neighbor {{vars.Peer5}} remote-as {{vars.Peer5ASN}}
 neighbor {{vars.Peer5}} description {{vars.Peer5Name | default(value="leaf-3")}}
{% endif %}{% if vars.Peer6 is defined %} neighbor {{vars.Peer6}} remote-as {{vars.Peer6ASN}}
 neighbor {{vars.Peer6}} description {{vars.Peer6Name | default(value="leaf-3")}}
{% endif %}{% if vars.Peer7 is defined %} neighbor {{vars.Peer7}} remote-as {{vars.Peer7ASN}}
 neighbor {{vars.Peer7}} description {{vars.Peer7Name | default(value="leaf-4")}}
{% endif %}{% if vars.Peer8 is defined %} neighbor {{vars.Peer8}} remote-as {{vars.Peer8ASN}}
 neighbor {{vars.Peer8}} description {{vars.Peer8Name | default(value="leaf-4")}}
{% endif %}{% if vars.Peer9 is defined %} neighbor {{vars.Peer9}} remote-as {{vars.Peer9ASN}}
 neighbor {{vars.Peer9}} description {{vars.Peer9Name | default(value="leaf-5")}}
{% endif %}{% if vars.Peer10 is defined %} neighbor {{vars.Peer10}} remote-as {{vars.Peer10ASN}}
 neighbor {{vars.Peer10}} description {{vars.Peer10Name | default(value="leaf-5")}}
{% endif %}{% if vars.Peer11 is defined %} neighbor {{vars.Peer11}} remote-as {{vars.Peer11ASN}}
 neighbor {{vars.Peer11}} description {{vars.Peer11Name | default(value="leaf-6")}}
{% endif %}{% if vars.Peer12 is defined %} neighbor {{vars.Peer12}} remote-as {{vars.Peer12ASN}}
 neighbor {{vars.Peer12}} description {{vars.Peer12Name | default(value="leaf-6")}}
{% endif %}{% if vars.Peer13 is defined %} neighbor {{vars.Peer13}} remote-as {{vars.Peer13ASN}}
 neighbor {{vars.Peer13}} description {{vars.Peer13Name | default(value="leaf-7")}}
{% endif %}{% if vars.Peer14 is defined %} neighbor {{vars.Peer14}} remote-as {{vars.Peer14ASN}}
 neighbor {{vars.Peer14}} description {{vars.Peer14Name | default(value="leaf-7")}}
{% endif %}{% if vars.Peer15 is defined %} neighbor {{vars.Peer15}} remote-as {{vars.Peer15ASN}}
 neighbor {{vars.Peer15}} description {{vars.Peer15Name | default(value="leaf-8")}}
{% endif %}{% if vars.Peer16 is defined %} neighbor {{vars.Peer16}} remote-as {{vars.Peer16ASN}}
 neighbor {{vars.Peer16}} description {{vars.Peer16Name | default(value="leaf-8")}}
{% endif %}{% if vars.Peer17 is defined %} neighbor {{vars.Peer17}} remote-as {{vars.Peer17ASN}}
 neighbor {{vars.Peer17}} description {{vars.Peer17Name | default(value="leaf-9")}}
{% endif %}{% if vars.Peer18 is defined %} neighbor {{vars.Peer18}} remote-as {{vars.Peer18ASN}}
 neighbor {{vars.Peer18}} description {{vars.Peer18Name | default(value="leaf-9")}}
{% endif %}{% if vars.Peer19 is defined %} neighbor {{vars.Peer19}} remote-as {{vars.Peer19ASN}}
 neighbor {{vars.Peer19}} description {{vars.Peer19Name | default(value="leaf-10")}}
{% endif %}{% if vars.Peer20 is defined %} neighbor {{vars.Peer20}} remote-as {{vars.Peer20ASN}}
 neighbor {{vars.Peer20}} description {{vars.Peer20Name | default(value="leaf-10")}}
{% endif %}{% if vars.Peer21 is defined %} neighbor {{vars.Peer21}} remote-as {{vars.Peer21ASN}}
 neighbor {{vars.Peer21}} description {{vars.Peer21Name | default(value="leaf-11")}}
{% endif %}{% if vars.Peer22 is defined %} neighbor {{vars.Peer22}} remote-as {{vars.Peer22ASN}}
 neighbor {{vars.Peer22}} description {{vars.Peer22Name | default(value="leaf-11")}}
{% endif %}{% if vars.Peer23 is defined %} neighbor {{vars.Peer23}} remote-as {{vars.Peer23ASN}}
 neighbor {{vars.Peer23}} description {{vars.Peer23Name | default(value="external-1")}}
{% endif %}{% if vars.Peer24 is defined %} neighbor {{vars.Peer24}} remote-as {{vars.Peer24ASN}}
 neighbor {{vars.Peer24}} description {{vars.Peer24Name | default(value="external-1")}}
{% endif %}{% if vars.Peer25 is defined %} neighbor {{vars.Peer25}} remote-as {{vars.Peer25ASN}}
 neighbor {{vars.Peer25}} description {{vars.Peer25Name | default(value="external-2")}}
{% endif %}{% if vars.Peer26 is defined %} neighbor {{vars.Peer26}} remote-as {{vars.Peer26ASN}}
 neighbor {{vars.Peer26}} description {{vars.Peer26Name | default(value="external-2")}}
{% endif %}{% if vars.Peer27 is defined %} neighbor {{vars.Peer27}} remote-as {{vars.Peer27ASN}}
 neighbor {{vars.Peer27}} description {{vars.Peer27Name | default(value="external-3")}}
{% endif %}{% if vars.Peer28 is defined %} neighbor {{vars.Peer28}} remote-as {{vars.Peer28ASN}}
 neighbor {{vars.Peer28}} description {{vars.Peer28Name | default(value="external-3")}}
{% endif %}{% if vars.Peer29 is defined %} neighbor {{vars.Peer29}} remote-as {{vars.Peer29ASN}}
 neighbor {{vars.Peer29}} description {{vars.Peer29Name | default(value="external-4")}}
{% endif %}{% if vars.Peer30 is defined %} neighbor {{vars.Peer30}} remote-as {{vars.Peer30ASN}}
 neighbor {{vars.Peer30}} description {{vars.Peer30Name | default(value="external-4")}}
{% endif %}{% if vars.Peer31 is defined %} neighbor {{vars.Peer31}} remote-as {{vars.Peer31ASN}}
 neighbor {{vars.Peer31}} description {{vars.Peer31Name | default(value="external-5")}}
{% endif %}{% if vars.Peer32 is defined %} neighbor {{vars.Peer32}} remote-as {{vars.Peer32ASN}}
 neighbor {{vars.Peer32}} description {{vars.Peer32Name | default(value="external-5")}}
{% endif %}
 address-family ipv4 unicast
  redistribute connected
 exit-address-family
\!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "frr-bgp-leaf".to_string(),
            name: "FRR BGP Leaf".to_string(),
            description: "FRR leaf role with BGP peering to spines via /31 point-to-point links".to_string(),
            vendor_id: "frr".to_string(),
            content: r#"{% if vars.ASN is defined %}\! ---- Leaf Role Configuration ----
\!
interface lo
 ip address {{vars.Loopback}}/32
\!
{% if vars.Peer1 is defined %}interface eth1
 description uplink-to-{{vars.Peer1Name | default(value="spine-1")}}-link1
 ip address {{vars.Peer1Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer2 is defined %}interface eth2
 description uplink-to-{{vars.Peer2Name | default(value="spine-1")}}-link2
 ip address {{vars.Peer2Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer3 is defined %}interface eth3
 description uplink-to-{{vars.Peer3Name | default(value="spine-2")}}-link1
 ip address {{vars.Peer3Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer4 is defined %}interface eth4
 description uplink-to-{{vars.Peer4Name | default(value="spine-2")}}-link2
 ip address {{vars.Peer4Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer5 is defined %}interface eth5
 description uplink-to-{{vars.Peer5Name | default(value="spine-3")}}-link1
 ip address {{vars.Peer5Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer6 is defined %}interface eth6
 description uplink-to-{{vars.Peer6Name | default(value="spine-3")}}-link2
 ip address {{vars.Peer6Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer7 is defined %}interface eth7
 description uplink-to-{{vars.Peer7Name | default(value="spine-4")}}-link1
 ip address {{vars.Peer7Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer8 is defined %}interface eth8
 description uplink-to-{{vars.Peer8Name | default(value="spine-4")}}-link2
 ip address {{vars.Peer8Addr}}/31
 no shutdown
\!
{% endif %}
router bgp {{vars.ASN}}
 bgp router-id {{vars.Loopback}}
 no bgp ebgp-requires-policy
 no bgp network import-check
{% if vars.Peer1 is defined %} neighbor {{vars.Peer1}} remote-as {{vars.Peer1ASN}}
 neighbor {{vars.Peer1}} description {{vars.Peer1Name | default(value="spine-1")}}
{% endif %}{% if vars.Peer2 is defined %} neighbor {{vars.Peer2}} remote-as {{vars.Peer2ASN}}
 neighbor {{vars.Peer2}} description {{vars.Peer2Name | default(value="spine-1")}}
{% endif %}{% if vars.Peer3 is defined %} neighbor {{vars.Peer3}} remote-as {{vars.Peer3ASN}}
 neighbor {{vars.Peer3}} description {{vars.Peer3Name | default(value="spine-2")}}
{% endif %}{% if vars.Peer4 is defined %} neighbor {{vars.Peer4}} remote-as {{vars.Peer4ASN}}
 neighbor {{vars.Peer4}} description {{vars.Peer4Name | default(value="spine-2")}}
{% endif %}{% if vars.Peer5 is defined %} neighbor {{vars.Peer5}} remote-as {{vars.Peer5ASN}}
 neighbor {{vars.Peer5}} description {{vars.Peer5Name | default(value="spine-3")}}
{% endif %}{% if vars.Peer6 is defined %} neighbor {{vars.Peer6}} remote-as {{vars.Peer6ASN}}
 neighbor {{vars.Peer6}} description {{vars.Peer6Name | default(value="spine-3")}}
{% endif %}{% if vars.Peer7 is defined %} neighbor {{vars.Peer7}} remote-as {{vars.Peer7ASN}}
 neighbor {{vars.Peer7}} description {{vars.Peer7Name | default(value="spine-4")}}
{% endif %}{% if vars.Peer8 is defined %} neighbor {{vars.Peer8}} remote-as {{vars.Peer8ASN}}
 neighbor {{vars.Peer8}} description {{vars.Peer8Name | default(value="spine-4")}}
{% endif %}
 address-family ipv4 unicast
  redistribute connected
 exit-address-family
\!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "arista-eos-external".to_string(),
            name: "Arista EOS External".to_string(),
            description: "External/uplink device config with BGP peering to CLOS spines".to_string(),
            vendor_id: "arista".to_string(),
            content: r#"{% if vars.ASN is defined %}! ---- External Device Role Configuration ----
!
spanning-tree mode none
!
interface Loopback0
   ip address {{vars.Loopback}}/32
!
{% if vars.Peer49 is defined %}interface Ethernet49
   description downlink-to-{{vars.Peer49Name | default(value="spine-1")}}-link1
   no switchport
   ip address {{vars.Peer49Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer50 is defined %}interface Ethernet50
   description downlink-to-{{vars.Peer50Name | default(value="spine-1")}}-link2
   no switchport
   ip address {{vars.Peer50Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer51 is defined %}interface Ethernet51
   description downlink-to-{{vars.Peer51Name | default(value="spine-2")}}-link1
   no switchport
   ip address {{vars.Peer51Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer52 is defined %}interface Ethernet52
   description downlink-to-{{vars.Peer52Name | default(value="spine-2")}}-link2
   no switchport
   ip address {{vars.Peer52Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer53 is defined %}interface Ethernet53
   description downlink-to-{{vars.Peer53Name | default(value="spine-3")}}-link1
   no switchport
   ip address {{vars.Peer53Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer54 is defined %}interface Ethernet54
   description downlink-to-{{vars.Peer54Name | default(value="spine-3")}}-link2
   no switchport
   ip address {{vars.Peer54Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer55 is defined %}interface Ethernet55
   description downlink-to-{{vars.Peer55Name | default(value="spine-4")}}-link1
   no switchport
   ip address {{vars.Peer55Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer56 is defined %}interface Ethernet56
   description downlink-to-{{vars.Peer56Name | default(value="spine-4")}}-link2
   no switchport
   ip address {{vars.Peer56Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}
ip routing
!
router bgp {{vars.ASN}}
   router-id {{vars.Loopback}}
   no bgp default ipv4-unicast
   maximum-paths 8 ecmp 8
   neighbor SPINES peer group
   neighbor SPINES send-community extended
{% if vars.Peer49 is defined %}   neighbor {{vars.Peer49}} peer group SPINES
   neighbor {{vars.Peer49}} remote-as {{vars.Peer49ASN}}
   neighbor {{vars.Peer49}} description {{vars.Peer49Name | default(value="spine-1")}}
{% endif %}{% if vars.Peer50 is defined %}   neighbor {{vars.Peer50}} peer group SPINES
   neighbor {{vars.Peer50}} remote-as {{vars.Peer50ASN}}
   neighbor {{vars.Peer50}} description {{vars.Peer50Name | default(value="spine-1")}}
{% endif %}{% if vars.Peer51 is defined %}   neighbor {{vars.Peer51}} peer group SPINES
   neighbor {{vars.Peer51}} remote-as {{vars.Peer51ASN}}
   neighbor {{vars.Peer51}} description {{vars.Peer51Name | default(value="spine-2")}}
{% endif %}{% if vars.Peer52 is defined %}   neighbor {{vars.Peer52}} peer group SPINES
   neighbor {{vars.Peer52}} remote-as {{vars.Peer52ASN}}
   neighbor {{vars.Peer52}} description {{vars.Peer52Name | default(value="spine-2")}}
{% endif %}{% if vars.Peer53 is defined %}   neighbor {{vars.Peer53}} peer group SPINES
   neighbor {{vars.Peer53}} remote-as {{vars.Peer53ASN}}
   neighbor {{vars.Peer53}} description {{vars.Peer53Name | default(value="spine-3")}}
{% endif %}{% if vars.Peer54 is defined %}   neighbor {{vars.Peer54}} peer group SPINES
   neighbor {{vars.Peer54}} remote-as {{vars.Peer54ASN}}
   neighbor {{vars.Peer54}} description {{vars.Peer54Name | default(value="spine-3")}}
{% endif %}{% if vars.Peer55 is defined %}   neighbor {{vars.Peer55}} peer group SPINES
   neighbor {{vars.Peer55}} remote-as {{vars.Peer55ASN}}
   neighbor {{vars.Peer55}} description {{vars.Peer55Name | default(value="spine-4")}}
{% endif %}{% if vars.Peer56 is defined %}   neighbor {{vars.Peer56}} peer group SPINES
   neighbor {{vars.Peer56}} remote-as {{vars.Peer56ASN}}
   neighbor {{vars.Peer56}} description {{vars.Peer56Name | default(value="spine-4")}}
{% endif %}
   !
   address-family ipv4 unicast
      neighbor SPINES activate
      redistribute connected
!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "frr-bgp-external".to_string(),
            name: "FRR BGP External".to_string(),
            description: "FRR external/uplink device with BGP peering to CLOS spines via /31 links".to_string(),
            vendor_id: "frr".to_string(),
            content: r#"{% if vars.ASN is defined %}\! ---- External Device Role Configuration ----
\!
interface lo
 ip address {{vars.Loopback}}/32
\!
{% if vars.Peer1 is defined %}interface eth1
 description downlink-to-{{vars.Peer1Name | default(value="spine-1")}}-link1
 ip address {{vars.Peer1Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer2 is defined %}interface eth2
 description downlink-to-{{vars.Peer2Name | default(value="spine-1")}}-link2
 ip address {{vars.Peer2Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer3 is defined %}interface eth3
 description downlink-to-{{vars.Peer3Name | default(value="spine-2")}}-link1
 ip address {{vars.Peer3Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer4 is defined %}interface eth4
 description downlink-to-{{vars.Peer4Name | default(value="spine-2")}}-link2
 ip address {{vars.Peer4Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer5 is defined %}interface eth5
 description downlink-to-{{vars.Peer5Name | default(value="spine-3")}}-link1
 ip address {{vars.Peer5Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer6 is defined %}interface eth6
 description downlink-to-{{vars.Peer6Name | default(value="spine-3")}}-link2
 ip address {{vars.Peer6Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer7 is defined %}interface eth7
 description downlink-to-{{vars.Peer7Name | default(value="spine-4")}}-link1
 ip address {{vars.Peer7Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer8 is defined %}interface eth8
 description downlink-to-{{vars.Peer8Name | default(value="spine-4")}}-link2
 ip address {{vars.Peer8Addr}}/31
 no shutdown
\!
{% endif %}
router bgp {{vars.ASN}}
 bgp router-id {{vars.Loopback}}
 no bgp ebgp-requires-policy
 no bgp network import-check
{% if vars.Peer1 is defined %} neighbor {{vars.Peer1}} remote-as {{vars.Peer1ASN}}
 neighbor {{vars.Peer1}} description {{vars.Peer1Name | default(value="spine-1")}}
{% endif %}{% if vars.Peer2 is defined %} neighbor {{vars.Peer2}} remote-as {{vars.Peer2ASN}}
 neighbor {{vars.Peer2}} description {{vars.Peer2Name | default(value="spine-1")}}
{% endif %}{% if vars.Peer3 is defined %} neighbor {{vars.Peer3}} remote-as {{vars.Peer3ASN}}
 neighbor {{vars.Peer3}} description {{vars.Peer3Name | default(value="spine-2")}}
{% endif %}{% if vars.Peer4 is defined %} neighbor {{vars.Peer4}} remote-as {{vars.Peer4ASN}}
 neighbor {{vars.Peer4}} description {{vars.Peer4Name | default(value="spine-2")}}
{% endif %}{% if vars.Peer5 is defined %} neighbor {{vars.Peer5}} remote-as {{vars.Peer5ASN}}
 neighbor {{vars.Peer5}} description {{vars.Peer5Name | default(value="spine-3")}}
{% endif %}{% if vars.Peer6 is defined %} neighbor {{vars.Peer6}} remote-as {{vars.Peer6ASN}}
 neighbor {{vars.Peer6}} description {{vars.Peer6Name | default(value="spine-3")}}
{% endif %}{% if vars.Peer7 is defined %} neighbor {{vars.Peer7}} remote-as {{vars.Peer7ASN}}
 neighbor {{vars.Peer7}} description {{vars.Peer7Name | default(value="spine-4")}}
{% endif %}{% if vars.Peer8 is defined %} neighbor {{vars.Peer8}} remote-as {{vars.Peer8ASN}}
 neighbor {{vars.Peer8}} description {{vars.Peer8Name | default(value="spine-4")}}
{% endif %}
 address-family ipv4 unicast
  redistribute connected
 exit-address-family
\!{% endif %}"#.to_string(),
        },
        // ========== Hierarchical (3-tier) role templates ==========
        DefaultTemplate {
            id: "arista-eos-core".to_string(),
            name: "Arista EOS Core".to_string(),
            description: "Hierarchical core role config with BGP underlay using device variables".to_string(),
            vendor_id: "arista".to_string(),
            content: r#"{% if vars.ASN is defined %}! ---- Core Role Configuration ----
!
spanning-tree mode none
!
interface Loopback0
   ip address {{vars.Loopback}}/32
!
{% if vars.Peer1 is defined %}interface Ethernet1
   description to-{{vars.Peer1Name | default(value="dist-1")}}-link1
   no switchport
   ip address {{vars.Peer1Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer2 is defined %}interface Ethernet2
   description to-{{vars.Peer2Name | default(value="dist-1")}}-link2
   no switchport
   ip address {{vars.Peer2Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer3 is defined %}interface Ethernet3
   description to-{{vars.Peer3Name | default(value="dist-2")}}-link1
   no switchport
   ip address {{vars.Peer3Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer4 is defined %}interface Ethernet4
   description to-{{vars.Peer4Name | default(value="dist-2")}}-link2
   no switchport
   ip address {{vars.Peer4Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer5 is defined %}interface Ethernet5
   description to-{{vars.Peer5Name | default(value="dist-3")}}-link1
   no switchport
   ip address {{vars.Peer5Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer6 is defined %}interface Ethernet6
   description to-{{vars.Peer6Name | default(value="dist-3")}}-link2
   no switchport
   ip address {{vars.Peer6Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer7 is defined %}interface Ethernet7
   description to-{{vars.Peer7Name | default(value="dist-4")}}-link1
   no switchport
   ip address {{vars.Peer7Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer8 is defined %}interface Ethernet8
   description to-{{vars.Peer8Name | default(value="dist-4")}}-link2
   no switchport
   ip address {{vars.Peer8Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer9 is defined %}interface Ethernet9
   description to-{{vars.Peer9Name | default(value="dist-5")}}-link1
   no switchport
   ip address {{vars.Peer9Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer10 is defined %}interface Ethernet10
   description to-{{vars.Peer10Name | default(value="dist-5")}}-link2
   no switchport
   ip address {{vars.Peer10Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer11 is defined %}interface Ethernet11
   description to-{{vars.Peer11Name | default(value="dist-6")}}-link1
   no switchport
   ip address {{vars.Peer11Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer12 is defined %}interface Ethernet12
   description to-{{vars.Peer12Name | default(value="dist-6")}}-link2
   no switchport
   ip address {{vars.Peer12Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer13 is defined %}interface Ethernet13
   description to-{{vars.Peer13Name | default(value="dist-7")}}-link1
   no switchport
   ip address {{vars.Peer13Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer14 is defined %}interface Ethernet14
   description to-{{vars.Peer14Name | default(value="dist-7")}}-link2
   no switchport
   ip address {{vars.Peer14Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer15 is defined %}interface Ethernet15
   description to-{{vars.Peer15Name | default(value="dist-8")}}-link1
   no switchport
   ip address {{vars.Peer15Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer16 is defined %}interface Ethernet16
   description to-{{vars.Peer16Name | default(value="dist-8")}}-link2
   no switchport
   ip address {{vars.Peer16Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}
ip routing
!
router bgp {{vars.ASN}}
   router-id {{vars.Loopback}}
   no bgp default ipv4-unicast
   maximum-paths 32 ecmp 32
   neighbor DISTRIBUTION peer group
   neighbor DISTRIBUTION send-community extended
{% if vars.Peer1 is defined %}   neighbor {{vars.Peer1}} peer group DISTRIBUTION
   neighbor {{vars.Peer1}} remote-as {{vars.Peer1ASN}}
   neighbor {{vars.Peer1}} description {{vars.Peer1Name | default(value="dist-1")}}
{% endif %}{% if vars.Peer2 is defined %}   neighbor {{vars.Peer2}} peer group DISTRIBUTION
   neighbor {{vars.Peer2}} remote-as {{vars.Peer2ASN}}
   neighbor {{vars.Peer2}} description {{vars.Peer2Name | default(value="dist-1")}}
{% endif %}{% if vars.Peer3 is defined %}   neighbor {{vars.Peer3}} peer group DISTRIBUTION
   neighbor {{vars.Peer3}} remote-as {{vars.Peer3ASN}}
   neighbor {{vars.Peer3}} description {{vars.Peer3Name | default(value="dist-2")}}
{% endif %}{% if vars.Peer4 is defined %}   neighbor {{vars.Peer4}} peer group DISTRIBUTION
   neighbor {{vars.Peer4}} remote-as {{vars.Peer4ASN}}
   neighbor {{vars.Peer4}} description {{vars.Peer4Name | default(value="dist-2")}}
{% endif %}{% if vars.Peer5 is defined %}   neighbor {{vars.Peer5}} peer group DISTRIBUTION
   neighbor {{vars.Peer5}} remote-as {{vars.Peer5ASN}}
   neighbor {{vars.Peer5}} description {{vars.Peer5Name | default(value="dist-3")}}
{% endif %}{% if vars.Peer6 is defined %}   neighbor {{vars.Peer6}} peer group DISTRIBUTION
   neighbor {{vars.Peer6}} remote-as {{vars.Peer6ASN}}
   neighbor {{vars.Peer6}} description {{vars.Peer6Name | default(value="dist-3")}}
{% endif %}{% if vars.Peer7 is defined %}   neighbor {{vars.Peer7}} peer group DISTRIBUTION
   neighbor {{vars.Peer7}} remote-as {{vars.Peer7ASN}}
   neighbor {{vars.Peer7}} description {{vars.Peer7Name | default(value="dist-4")}}
{% endif %}{% if vars.Peer8 is defined %}   neighbor {{vars.Peer8}} peer group DISTRIBUTION
   neighbor {{vars.Peer8}} remote-as {{vars.Peer8ASN}}
   neighbor {{vars.Peer8}} description {{vars.Peer8Name | default(value="dist-4")}}
{% endif %}{% if vars.Peer9 is defined %}   neighbor {{vars.Peer9}} peer group DISTRIBUTION
   neighbor {{vars.Peer9}} remote-as {{vars.Peer9ASN}}
   neighbor {{vars.Peer9}} description {{vars.Peer9Name | default(value="dist-5")}}
{% endif %}{% if vars.Peer10 is defined %}   neighbor {{vars.Peer10}} peer group DISTRIBUTION
   neighbor {{vars.Peer10}} remote-as {{vars.Peer10ASN}}
   neighbor {{vars.Peer10}} description {{vars.Peer10Name | default(value="dist-5")}}
{% endif %}{% if vars.Peer11 is defined %}   neighbor {{vars.Peer11}} peer group DISTRIBUTION
   neighbor {{vars.Peer11}} remote-as {{vars.Peer11ASN}}
   neighbor {{vars.Peer11}} description {{vars.Peer11Name | default(value="dist-6")}}
{% endif %}{% if vars.Peer12 is defined %}   neighbor {{vars.Peer12}} peer group DISTRIBUTION
   neighbor {{vars.Peer12}} remote-as {{vars.Peer12ASN}}
   neighbor {{vars.Peer12}} description {{vars.Peer12Name | default(value="dist-6")}}
{% endif %}{% if vars.Peer13 is defined %}   neighbor {{vars.Peer13}} peer group DISTRIBUTION
   neighbor {{vars.Peer13}} remote-as {{vars.Peer13ASN}}
   neighbor {{vars.Peer13}} description {{vars.Peer13Name | default(value="dist-7")}}
{% endif %}{% if vars.Peer14 is defined %}   neighbor {{vars.Peer14}} peer group DISTRIBUTION
   neighbor {{vars.Peer14}} remote-as {{vars.Peer14ASN}}
   neighbor {{vars.Peer14}} description {{vars.Peer14Name | default(value="dist-7")}}
{% endif %}{% if vars.Peer15 is defined %}   neighbor {{vars.Peer15}} peer group DISTRIBUTION
   neighbor {{vars.Peer15}} remote-as {{vars.Peer15ASN}}
   neighbor {{vars.Peer15}} description {{vars.Peer15Name | default(value="dist-8")}}
{% endif %}{% if vars.Peer16 is defined %}   neighbor {{vars.Peer16}} peer group DISTRIBUTION
   neighbor {{vars.Peer16}} remote-as {{vars.Peer16ASN}}
   neighbor {{vars.Peer16}} description {{vars.Peer16Name | default(value="dist-8")}}
{% endif %}
   !
   address-family ipv4 unicast
      neighbor DISTRIBUTION activate
      redistribute connected
!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "arista-eos-distribution".to_string(),
            name: "Arista EOS Distribution".to_string(),
            description: "Hierarchical distribution role config with BGP underlay — downlinks to access, uplinks to core".to_string(),
            vendor_id: "arista".to_string(),
            content: r#"{% if vars.ASN is defined %}! ---- Distribution Role Configuration ----
!
spanning-tree mode mstp
!
interface Loopback0
   ip address {{vars.Loopback}}/32
!
{% if vars.Peer1 is defined %}interface Ethernet1
   description to-{{vars.Peer1Name | default(value="access-1")}}-link1
   no switchport
   ip address {{vars.Peer1Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer2 is defined %}interface Ethernet2
   description to-{{vars.Peer2Name | default(value="access-1")}}-link2
   no switchport
   ip address {{vars.Peer2Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer3 is defined %}interface Ethernet3
   description to-{{vars.Peer3Name | default(value="access-2")}}-link1
   no switchport
   ip address {{vars.Peer3Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer4 is defined %}interface Ethernet4
   description to-{{vars.Peer4Name | default(value="access-2")}}-link2
   no switchport
   ip address {{vars.Peer4Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer5 is defined %}interface Ethernet5
   description to-{{vars.Peer5Name | default(value="access-3")}}-link1
   no switchport
   ip address {{vars.Peer5Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer6 is defined %}interface Ethernet6
   description to-{{vars.Peer6Name | default(value="access-3")}}-link2
   no switchport
   ip address {{vars.Peer6Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer7 is defined %}interface Ethernet7
   description to-{{vars.Peer7Name | default(value="access-4")}}-link1
   no switchport
   ip address {{vars.Peer7Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer8 is defined %}interface Ethernet8
   description to-{{vars.Peer8Name | default(value="access-4")}}-link2
   no switchport
   ip address {{vars.Peer8Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer9 is defined %}interface Ethernet9
   description to-{{vars.Peer9Name | default(value="access-5")}}-link1
   no switchport
   ip address {{vars.Peer9Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer10 is defined %}interface Ethernet10
   description to-{{vars.Peer10Name | default(value="access-5")}}-link2
   no switchport
   ip address {{vars.Peer10Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer11 is defined %}interface Ethernet11
   description to-{{vars.Peer11Name | default(value="access-6")}}-link1
   no switchport
   ip address {{vars.Peer11Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer12 is defined %}interface Ethernet12
   description to-{{vars.Peer12Name | default(value="access-6")}}-link2
   no switchport
   ip address {{vars.Peer12Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer13 is defined %}interface Ethernet13
   description to-{{vars.Peer13Name | default(value="access-7")}}-link1
   no switchport
   ip address {{vars.Peer13Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer14 is defined %}interface Ethernet14
   description to-{{vars.Peer14Name | default(value="access-7")}}-link2
   no switchport
   ip address {{vars.Peer14Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer15 is defined %}interface Ethernet15
   description to-{{vars.Peer15Name | default(value="access-8")}}-link1
   no switchport
   ip address {{vars.Peer15Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer16 is defined %}interface Ethernet16
   description to-{{vars.Peer16Name | default(value="access-8")}}-link2
   no switchport
   ip address {{vars.Peer16Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer17 is defined %}interface Ethernet17
   description to-{{vars.Peer17Name | default(value="access-9")}}-link1
   no switchport
   ip address {{vars.Peer17Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer18 is defined %}interface Ethernet18
   description to-{{vars.Peer18Name | default(value="access-9")}}-link2
   no switchport
   ip address {{vars.Peer18Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer19 is defined %}interface Ethernet19
   description to-{{vars.Peer19Name | default(value="access-10")}}-link1
   no switchport
   ip address {{vars.Peer19Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer20 is defined %}interface Ethernet20
   description to-{{vars.Peer20Name | default(value="access-10")}}-link2
   no switchport
   ip address {{vars.Peer20Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer21 is defined %}interface Ethernet21
   description to-{{vars.Peer21Name | default(value="access-11")}}-link1
   no switchport
   ip address {{vars.Peer21Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer22 is defined %}interface Ethernet22
   description to-{{vars.Peer22Name | default(value="access-11")}}-link2
   no switchport
   ip address {{vars.Peer22Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer23 is defined %}interface Ethernet23
   description uplink-to-{{vars.Peer23Name | default(value="core-1")}}-link1
   no switchport
   ip address {{vars.Peer23Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer24 is defined %}interface Ethernet24
   description uplink-to-{{vars.Peer24Name | default(value="core-1")}}-link2
   no switchport
   ip address {{vars.Peer24Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer25 is defined %}interface Ethernet25
   description uplink-to-{{vars.Peer25Name | default(value="core-2")}}-link1
   no switchport
   ip address {{vars.Peer25Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer26 is defined %}interface Ethernet26
   description uplink-to-{{vars.Peer26Name | default(value="core-2")}}-link2
   no switchport
   ip address {{vars.Peer26Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer27 is defined %}interface Ethernet27
   description uplink-to-{{vars.Peer27Name | default(value="core-3")}}-link1
   no switchport
   ip address {{vars.Peer27Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer28 is defined %}interface Ethernet28
   description uplink-to-{{vars.Peer28Name | default(value="core-3")}}-link2
   no switchport
   ip address {{vars.Peer28Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer29 is defined %}interface Ethernet29
   description uplink-to-{{vars.Peer29Name | default(value="core-4")}}-link1
   no switchport
   ip address {{vars.Peer29Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer30 is defined %}interface Ethernet30
   description uplink-to-{{vars.Peer30Name | default(value="core-4")}}-link2
   no switchport
   ip address {{vars.Peer30Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer31 is defined %}interface Ethernet31
   description uplink-to-{{vars.Peer31Name | default(value="core-5")}}-link1
   no switchport
   ip address {{vars.Peer31Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer32 is defined %}interface Ethernet32
   description uplink-to-{{vars.Peer32Name | default(value="core-5")}}-link2
   no switchport
   ip address {{vars.Peer32Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}
ip routing
!
router bgp {{vars.ASN}}
   router-id {{vars.Loopback}}
   no bgp default ipv4-unicast
   maximum-paths 32 ecmp 32
   neighbor ACCESS peer group
   neighbor ACCESS send-community extended
   neighbor CORE peer group
   neighbor CORE send-community extended
{% if vars.Peer1 is defined %}   neighbor {{vars.Peer1}} peer group ACCESS
   neighbor {{vars.Peer1}} remote-as {{vars.Peer1ASN}}
   neighbor {{vars.Peer1}} description {{vars.Peer1Name | default(value="access-1")}}
{% endif %}{% if vars.Peer2 is defined %}   neighbor {{vars.Peer2}} peer group ACCESS
   neighbor {{vars.Peer2}} remote-as {{vars.Peer2ASN}}
   neighbor {{vars.Peer2}} description {{vars.Peer2Name | default(value="access-1")}}
{% endif %}{% if vars.Peer3 is defined %}   neighbor {{vars.Peer3}} peer group ACCESS
   neighbor {{vars.Peer3}} remote-as {{vars.Peer3ASN}}
   neighbor {{vars.Peer3}} description {{vars.Peer3Name | default(value="access-2")}}
{% endif %}{% if vars.Peer4 is defined %}   neighbor {{vars.Peer4}} peer group ACCESS
   neighbor {{vars.Peer4}} remote-as {{vars.Peer4ASN}}
   neighbor {{vars.Peer4}} description {{vars.Peer4Name | default(value="access-2")}}
{% endif %}{% if vars.Peer5 is defined %}   neighbor {{vars.Peer5}} peer group ACCESS
   neighbor {{vars.Peer5}} remote-as {{vars.Peer5ASN}}
   neighbor {{vars.Peer5}} description {{vars.Peer5Name | default(value="access-3")}}
{% endif %}{% if vars.Peer6 is defined %}   neighbor {{vars.Peer6}} peer group ACCESS
   neighbor {{vars.Peer6}} remote-as {{vars.Peer6ASN}}
   neighbor {{vars.Peer6}} description {{vars.Peer6Name | default(value="access-3")}}
{% endif %}{% if vars.Peer7 is defined %}   neighbor {{vars.Peer7}} peer group ACCESS
   neighbor {{vars.Peer7}} remote-as {{vars.Peer7ASN}}
   neighbor {{vars.Peer7}} description {{vars.Peer7Name | default(value="access-4")}}
{% endif %}{% if vars.Peer8 is defined %}   neighbor {{vars.Peer8}} peer group ACCESS
   neighbor {{vars.Peer8}} remote-as {{vars.Peer8ASN}}
   neighbor {{vars.Peer8}} description {{vars.Peer8Name | default(value="access-4")}}
{% endif %}{% if vars.Peer9 is defined %}   neighbor {{vars.Peer9}} peer group ACCESS
   neighbor {{vars.Peer9}} remote-as {{vars.Peer9ASN}}
   neighbor {{vars.Peer9}} description {{vars.Peer9Name | default(value="access-5")}}
{% endif %}{% if vars.Peer10 is defined %}   neighbor {{vars.Peer10}} peer group ACCESS
   neighbor {{vars.Peer10}} remote-as {{vars.Peer10ASN}}
   neighbor {{vars.Peer10}} description {{vars.Peer10Name | default(value="access-5")}}
{% endif %}{% if vars.Peer11 is defined %}   neighbor {{vars.Peer11}} peer group ACCESS
   neighbor {{vars.Peer11}} remote-as {{vars.Peer11ASN}}
   neighbor {{vars.Peer11}} description {{vars.Peer11Name | default(value="access-6")}}
{% endif %}{% if vars.Peer12 is defined %}   neighbor {{vars.Peer12}} peer group ACCESS
   neighbor {{vars.Peer12}} remote-as {{vars.Peer12ASN}}
   neighbor {{vars.Peer12}} description {{vars.Peer12Name | default(value="access-6")}}
{% endif %}{% if vars.Peer13 is defined %}   neighbor {{vars.Peer13}} peer group ACCESS
   neighbor {{vars.Peer13}} remote-as {{vars.Peer13ASN}}
   neighbor {{vars.Peer13}} description {{vars.Peer13Name | default(value="access-7")}}
{% endif %}{% if vars.Peer14 is defined %}   neighbor {{vars.Peer14}} peer group ACCESS
   neighbor {{vars.Peer14}} remote-as {{vars.Peer14ASN}}
   neighbor {{vars.Peer14}} description {{vars.Peer14Name | default(value="access-7")}}
{% endif %}{% if vars.Peer15 is defined %}   neighbor {{vars.Peer15}} peer group ACCESS
   neighbor {{vars.Peer15}} remote-as {{vars.Peer15ASN}}
   neighbor {{vars.Peer15}} description {{vars.Peer15Name | default(value="access-8")}}
{% endif %}{% if vars.Peer16 is defined %}   neighbor {{vars.Peer16}} peer group ACCESS
   neighbor {{vars.Peer16}} remote-as {{vars.Peer16ASN}}
   neighbor {{vars.Peer16}} description {{vars.Peer16Name | default(value="access-8")}}
{% endif %}{% if vars.Peer17 is defined %}   neighbor {{vars.Peer17}} peer group ACCESS
   neighbor {{vars.Peer17}} remote-as {{vars.Peer17ASN}}
   neighbor {{vars.Peer17}} description {{vars.Peer17Name | default(value="access-9")}}
{% endif %}{% if vars.Peer18 is defined %}   neighbor {{vars.Peer18}} peer group ACCESS
   neighbor {{vars.Peer18}} remote-as {{vars.Peer18ASN}}
   neighbor {{vars.Peer18}} description {{vars.Peer18Name | default(value="access-9")}}
{% endif %}{% if vars.Peer19 is defined %}   neighbor {{vars.Peer19}} peer group ACCESS
   neighbor {{vars.Peer19}} remote-as {{vars.Peer19ASN}}
   neighbor {{vars.Peer19}} description {{vars.Peer19Name | default(value="access-10")}}
{% endif %}{% if vars.Peer20 is defined %}   neighbor {{vars.Peer20}} peer group ACCESS
   neighbor {{vars.Peer20}} remote-as {{vars.Peer20ASN}}
   neighbor {{vars.Peer20}} description {{vars.Peer20Name | default(value="access-10")}}
{% endif %}{% if vars.Peer21 is defined %}   neighbor {{vars.Peer21}} peer group ACCESS
   neighbor {{vars.Peer21}} remote-as {{vars.Peer21ASN}}
   neighbor {{vars.Peer21}} description {{vars.Peer21Name | default(value="access-11")}}
{% endif %}{% if vars.Peer22 is defined %}   neighbor {{vars.Peer22}} peer group ACCESS
   neighbor {{vars.Peer22}} remote-as {{vars.Peer22ASN}}
   neighbor {{vars.Peer22}} description {{vars.Peer22Name | default(value="access-11")}}
{% endif %}{% if vars.Peer23 is defined %}   neighbor {{vars.Peer23}} peer group CORE
   neighbor {{vars.Peer23}} remote-as {{vars.Peer23ASN}}
   neighbor {{vars.Peer23}} description {{vars.Peer23Name | default(value="core-1")}}
{% endif %}{% if vars.Peer24 is defined %}   neighbor {{vars.Peer24}} peer group CORE
   neighbor {{vars.Peer24}} remote-as {{vars.Peer24ASN}}
   neighbor {{vars.Peer24}} description {{vars.Peer24Name | default(value="core-1")}}
{% endif %}{% if vars.Peer25 is defined %}   neighbor {{vars.Peer25}} peer group CORE
   neighbor {{vars.Peer25}} remote-as {{vars.Peer25ASN}}
   neighbor {{vars.Peer25}} description {{vars.Peer25Name | default(value="core-2")}}
{% endif %}{% if vars.Peer26 is defined %}   neighbor {{vars.Peer26}} peer group CORE
   neighbor {{vars.Peer26}} remote-as {{vars.Peer26ASN}}
   neighbor {{vars.Peer26}} description {{vars.Peer26Name | default(value="core-2")}}
{% endif %}{% if vars.Peer27 is defined %}   neighbor {{vars.Peer27}} peer group CORE
   neighbor {{vars.Peer27}} remote-as {{vars.Peer27ASN}}
   neighbor {{vars.Peer27}} description {{vars.Peer27Name | default(value="core-3")}}
{% endif %}{% if vars.Peer28 is defined %}   neighbor {{vars.Peer28}} peer group CORE
   neighbor {{vars.Peer28}} remote-as {{vars.Peer28ASN}}
   neighbor {{vars.Peer28}} description {{vars.Peer28Name | default(value="core-3")}}
{% endif %}{% if vars.Peer29 is defined %}   neighbor {{vars.Peer29}} peer group CORE
   neighbor {{vars.Peer29}} remote-as {{vars.Peer29ASN}}
   neighbor {{vars.Peer29}} description {{vars.Peer29Name | default(value="core-4")}}
{% endif %}{% if vars.Peer30 is defined %}   neighbor {{vars.Peer30}} peer group CORE
   neighbor {{vars.Peer30}} remote-as {{vars.Peer30ASN}}
   neighbor {{vars.Peer30}} description {{vars.Peer30Name | default(value="core-4")}}
{% endif %}{% if vars.Peer31 is defined %}   neighbor {{vars.Peer31}} peer group CORE
   neighbor {{vars.Peer31}} remote-as {{vars.Peer31ASN}}
   neighbor {{vars.Peer31}} description {{vars.Peer31Name | default(value="core-5")}}
{% endif %}{% if vars.Peer32 is defined %}   neighbor {{vars.Peer32}} peer group CORE
   neighbor {{vars.Peer32}} remote-as {{vars.Peer32ASN}}
   neighbor {{vars.Peer32}} description {{vars.Peer32Name | default(value="core-5")}}
{% endif %}
   !
   address-family ipv4 unicast
      neighbor ACCESS activate
      neighbor CORE activate
      redistribute connected
!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "arista-eos-access".to_string(),
            name: "Arista EOS Access".to_string(),
            description: "Hierarchical access role config with BGP underlay using device variables".to_string(),
            vendor_id: "arista".to_string(),
            content: r#"{% if vars.ASN is defined %}! ---- Access Role Configuration ----
!
spanning-tree mode mstp
!
vlan 10
   name Servers
!
vlan 20
   name Storage
!
interface Loopback0
   ip address {{vars.Loopback}}/32
!
{% if vars.Peer49 is defined %}interface Ethernet49
   description uplink-to-{{vars.Peer49Name | default(value="dist-1")}}-link1
   no switchport
   ip address {{vars.Peer49Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer50 is defined %}interface Ethernet50
   description uplink-to-{{vars.Peer50Name | default(value="dist-1")}}-link2
   no switchport
   ip address {{vars.Peer50Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer51 is defined %}interface Ethernet51
   description uplink-to-{{vars.Peer51Name | default(value="dist-2")}}-link1
   no switchport
   ip address {{vars.Peer51Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer52 is defined %}interface Ethernet52
   description uplink-to-{{vars.Peer52Name | default(value="dist-2")}}-link2
   no switchport
   ip address {{vars.Peer52Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer53 is defined %}interface Ethernet53
   description uplink-to-{{vars.Peer53Name | default(value="dist-3")}}-link1
   no switchport
   ip address {{vars.Peer53Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer54 is defined %}interface Ethernet54
   description uplink-to-{{vars.Peer54Name | default(value="dist-3")}}-link2
   no switchport
   ip address {{vars.Peer54Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer55 is defined %}interface Ethernet55
   description uplink-to-{{vars.Peer55Name | default(value="dist-4")}}-link1
   no switchport
   ip address {{vars.Peer55Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}{% if vars.Peer56 is defined %}interface Ethernet56
   description uplink-to-{{vars.Peer56Name | default(value="dist-4")}}-link2
   no switchport
   ip address {{vars.Peer56Addr}}/31
   mtu 9214
   no shutdown
!
{% endif %}
ip routing
!
router bgp {{vars.ASN}}
   router-id {{vars.Loopback}}
   no bgp default ipv4-unicast
   maximum-paths 8 ecmp 8
   neighbor DISTRIBUTION peer group
   neighbor DISTRIBUTION send-community extended
{% if vars.Peer49 is defined %}   neighbor {{vars.Peer49}} peer group DISTRIBUTION
   neighbor {{vars.Peer49}} remote-as {{vars.Peer49ASN}}
   neighbor {{vars.Peer49}} description {{vars.Peer49Name | default(value="dist-1")}}
{% endif %}{% if vars.Peer50 is defined %}   neighbor {{vars.Peer50}} peer group DISTRIBUTION
   neighbor {{vars.Peer50}} remote-as {{vars.Peer50ASN}}
   neighbor {{vars.Peer50}} description {{vars.Peer50Name | default(value="dist-1")}}
{% endif %}{% if vars.Peer51 is defined %}   neighbor {{vars.Peer51}} peer group DISTRIBUTION
   neighbor {{vars.Peer51}} remote-as {{vars.Peer51ASN}}
   neighbor {{vars.Peer51}} description {{vars.Peer51Name | default(value="dist-2")}}
{% endif %}{% if vars.Peer52 is defined %}   neighbor {{vars.Peer52}} peer group DISTRIBUTION
   neighbor {{vars.Peer52}} remote-as {{vars.Peer52ASN}}
   neighbor {{vars.Peer52}} description {{vars.Peer52Name | default(value="dist-2")}}
{% endif %}{% if vars.Peer53 is defined %}   neighbor {{vars.Peer53}} peer group DISTRIBUTION
   neighbor {{vars.Peer53}} remote-as {{vars.Peer53ASN}}
   neighbor {{vars.Peer53}} description {{vars.Peer53Name | default(value="dist-3")}}
{% endif %}{% if vars.Peer54 is defined %}   neighbor {{vars.Peer54}} peer group DISTRIBUTION
   neighbor {{vars.Peer54}} remote-as {{vars.Peer54ASN}}
   neighbor {{vars.Peer54}} description {{vars.Peer54Name | default(value="dist-3")}}
{% endif %}{% if vars.Peer55 is defined %}   neighbor {{vars.Peer55}} peer group DISTRIBUTION
   neighbor {{vars.Peer55}} remote-as {{vars.Peer55ASN}}
   neighbor {{vars.Peer55}} description {{vars.Peer55Name | default(value="dist-4")}}
{% endif %}{% if vars.Peer56 is defined %}   neighbor {{vars.Peer56}} peer group DISTRIBUTION
   neighbor {{vars.Peer56}} remote-as {{vars.Peer56ASN}}
   neighbor {{vars.Peer56}} description {{vars.Peer56Name | default(value="dist-4")}}
{% endif %}
   !
   address-family ipv4 unicast
      neighbor DISTRIBUTION activate
      redistribute connected
!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "frr-bgp-core".to_string(),
            name: "FRR BGP Core".to_string(),
            description: "FRR core role with BGP peering to distribution via /31 point-to-point links".to_string(),
            vendor_id: "frr".to_string(),
            content: r#"{% if vars.ASN is defined %}\! ---- Core Role Configuration ----
\!
interface lo
 ip address {{vars.Loopback}}/32
\!
{% if vars.Peer1 is defined %}interface eth1
 description to-{{vars.Peer1Name | default(value="dist-1")}}-link1
 ip address {{vars.Peer1Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer2 is defined %}interface eth2
 description to-{{vars.Peer2Name | default(value="dist-1")}}-link2
 ip address {{vars.Peer2Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer3 is defined %}interface eth3
 description to-{{vars.Peer3Name | default(value="dist-2")}}-link1
 ip address {{vars.Peer3Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer4 is defined %}interface eth4
 description to-{{vars.Peer4Name | default(value="dist-2")}}-link2
 ip address {{vars.Peer4Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer5 is defined %}interface eth5
 description to-{{vars.Peer5Name | default(value="dist-3")}}-link1
 ip address {{vars.Peer5Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer6 is defined %}interface eth6
 description to-{{vars.Peer6Name | default(value="dist-3")}}-link2
 ip address {{vars.Peer6Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer7 is defined %}interface eth7
 description to-{{vars.Peer7Name | default(value="dist-4")}}-link1
 ip address {{vars.Peer7Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer8 is defined %}interface eth8
 description to-{{vars.Peer8Name | default(value="dist-4")}}-link2
 ip address {{vars.Peer8Addr}}/31
 no shutdown
\!
{% endif %}
router bgp {{vars.ASN}}
 bgp router-id {{vars.Loopback}}
 no bgp ebgp-requires-policy
 no bgp network import-check
{% if vars.Peer1 is defined %} neighbor {{vars.Peer1}} remote-as {{vars.Peer1ASN}}
 neighbor {{vars.Peer1}} description {{vars.Peer1Name | default(value="dist-1")}}
{% endif %}{% if vars.Peer2 is defined %} neighbor {{vars.Peer2}} remote-as {{vars.Peer2ASN}}
 neighbor {{vars.Peer2}} description {{vars.Peer2Name | default(value="dist-1")}}
{% endif %}{% if vars.Peer3 is defined %} neighbor {{vars.Peer3}} remote-as {{vars.Peer3ASN}}
 neighbor {{vars.Peer3}} description {{vars.Peer3Name | default(value="dist-2")}}
{% endif %}{% if vars.Peer4 is defined %} neighbor {{vars.Peer4}} remote-as {{vars.Peer4ASN}}
 neighbor {{vars.Peer4}} description {{vars.Peer4Name | default(value="dist-2")}}
{% endif %}{% if vars.Peer5 is defined %} neighbor {{vars.Peer5}} remote-as {{vars.Peer5ASN}}
 neighbor {{vars.Peer5}} description {{vars.Peer5Name | default(value="dist-3")}}
{% endif %}{% if vars.Peer6 is defined %} neighbor {{vars.Peer6}} remote-as {{vars.Peer6ASN}}
 neighbor {{vars.Peer6}} description {{vars.Peer6Name | default(value="dist-3")}}
{% endif %}{% if vars.Peer7 is defined %} neighbor {{vars.Peer7}} remote-as {{vars.Peer7ASN}}
 neighbor {{vars.Peer7}} description {{vars.Peer7Name | default(value="dist-4")}}
{% endif %}{% if vars.Peer8 is defined %} neighbor {{vars.Peer8}} remote-as {{vars.Peer8ASN}}
 neighbor {{vars.Peer8}} description {{vars.Peer8Name | default(value="dist-4")}}
{% endif %}
 address-family ipv4 unicast
  redistribute connected
 exit-address-family
\!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "frr-bgp-distribution".to_string(),
            name: "FRR BGP Distribution".to_string(),
            description: "FRR distribution role with BGP peering to access and core via /31 links".to_string(),
            vendor_id: "frr".to_string(),
            content: r#"{% if vars.ASN is defined %}\! ---- Distribution Role Configuration ----
\!
interface lo
 ip address {{vars.Loopback}}/32
\!
{% if vars.Peer1 is defined %}interface eth1
 description to-{{vars.Peer1Name | default(value="access-1")}}-link1
 ip address {{vars.Peer1Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer2 is defined %}interface eth2
 description to-{{vars.Peer2Name | default(value="access-1")}}-link2
 ip address {{vars.Peer2Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer3 is defined %}interface eth3
 description to-{{vars.Peer3Name | default(value="access-2")}}-link1
 ip address {{vars.Peer3Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer4 is defined %}interface eth4
 description to-{{vars.Peer4Name | default(value="access-2")}}-link2
 ip address {{vars.Peer4Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer5 is defined %}interface eth5
 description to-{{vars.Peer5Name | default(value="access-3")}}-link1
 ip address {{vars.Peer5Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer6 is defined %}interface eth6
 description to-{{vars.Peer6Name | default(value="access-3")}}-link2
 ip address {{vars.Peer6Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer7 is defined %}interface eth7
 description to-{{vars.Peer7Name | default(value="access-4")}}-link1
 ip address {{vars.Peer7Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer8 is defined %}interface eth8
 description to-{{vars.Peer8Name | default(value="access-4")}}-link2
 ip address {{vars.Peer8Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer9 is defined %}interface eth9
 description uplink-to-{{vars.Peer9Name | default(value="core-1")}}-link1
 ip address {{vars.Peer9Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer10 is defined %}interface eth10
 description uplink-to-{{vars.Peer10Name | default(value="core-1")}}-link2
 ip address {{vars.Peer10Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer11 is defined %}interface eth11
 description uplink-to-{{vars.Peer11Name | default(value="core-2")}}-link1
 ip address {{vars.Peer11Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer12 is defined %}interface eth12
 description uplink-to-{{vars.Peer12Name | default(value="core-2")}}-link2
 ip address {{vars.Peer12Addr}}/31
 no shutdown
\!
{% endif %}
router bgp {{vars.ASN}}
 bgp router-id {{vars.Loopback}}
 no bgp ebgp-requires-policy
 no bgp network import-check
{% if vars.Peer1 is defined %} neighbor {{vars.Peer1}} remote-as {{vars.Peer1ASN}}
 neighbor {{vars.Peer1}} description {{vars.Peer1Name | default(value="access-1")}}
{% endif %}{% if vars.Peer2 is defined %} neighbor {{vars.Peer2}} remote-as {{vars.Peer2ASN}}
 neighbor {{vars.Peer2}} description {{vars.Peer2Name | default(value="access-1")}}
{% endif %}{% if vars.Peer3 is defined %} neighbor {{vars.Peer3}} remote-as {{vars.Peer3ASN}}
 neighbor {{vars.Peer3}} description {{vars.Peer3Name | default(value="access-2")}}
{% endif %}{% if vars.Peer4 is defined %} neighbor {{vars.Peer4}} remote-as {{vars.Peer4ASN}}
 neighbor {{vars.Peer4}} description {{vars.Peer4Name | default(value="access-2")}}
{% endif %}{% if vars.Peer5 is defined %} neighbor {{vars.Peer5}} remote-as {{vars.Peer5ASN}}
 neighbor {{vars.Peer5}} description {{vars.Peer5Name | default(value="access-3")}}
{% endif %}{% if vars.Peer6 is defined %} neighbor {{vars.Peer6}} remote-as {{vars.Peer6ASN}}
 neighbor {{vars.Peer6}} description {{vars.Peer6Name | default(value="access-3")}}
{% endif %}{% if vars.Peer7 is defined %} neighbor {{vars.Peer7}} remote-as {{vars.Peer7ASN}}
 neighbor {{vars.Peer7}} description {{vars.Peer7Name | default(value="access-4")}}
{% endif %}{% if vars.Peer8 is defined %} neighbor {{vars.Peer8}} remote-as {{vars.Peer8ASN}}
 neighbor {{vars.Peer8}} description {{vars.Peer8Name | default(value="access-4")}}
{% endif %}{% if vars.Peer9 is defined %} neighbor {{vars.Peer9}} remote-as {{vars.Peer9ASN}}
 neighbor {{vars.Peer9}} description {{vars.Peer9Name | default(value="core-1")}}
{% endif %}{% if vars.Peer10 is defined %} neighbor {{vars.Peer10}} remote-as {{vars.Peer10ASN}}
 neighbor {{vars.Peer10}} description {{vars.Peer10Name | default(value="core-1")}}
{% endif %}{% if vars.Peer11 is defined %} neighbor {{vars.Peer11}} remote-as {{vars.Peer11ASN}}
 neighbor {{vars.Peer11}} description {{vars.Peer11Name | default(value="core-2")}}
{% endif %}{% if vars.Peer12 is defined %} neighbor {{vars.Peer12}} remote-as {{vars.Peer12ASN}}
 neighbor {{vars.Peer12}} description {{vars.Peer12Name | default(value="core-2")}}
{% endif %}
 address-family ipv4 unicast
  redistribute connected
 exit-address-family
\!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "frr-bgp-access".to_string(),
            name: "FRR BGP Access".to_string(),
            description: "FRR access role with BGP peering to distribution via /31 links".to_string(),
            vendor_id: "frr".to_string(),
            content: r#"{% if vars.ASN is defined %}\! ---- Access Role Configuration ----
\!
interface lo
 ip address {{vars.Loopback}}/32
\!
{% if vars.Peer1 is defined %}interface eth1
 description uplink-to-{{vars.Peer1Name | default(value="dist-1")}}-link1
 ip address {{vars.Peer1Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer2 is defined %}interface eth2
 description uplink-to-{{vars.Peer2Name | default(value="dist-1")}}-link2
 ip address {{vars.Peer2Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer3 is defined %}interface eth3
 description uplink-to-{{vars.Peer3Name | default(value="dist-2")}}-link1
 ip address {{vars.Peer3Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer4 is defined %}interface eth4
 description uplink-to-{{vars.Peer4Name | default(value="dist-2")}}-link2
 ip address {{vars.Peer4Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer5 is defined %}interface eth5
 description uplink-to-{{vars.Peer5Name | default(value="dist-3")}}-link1
 ip address {{vars.Peer5Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer6 is defined %}interface eth6
 description uplink-to-{{vars.Peer6Name | default(value="dist-3")}}-link2
 ip address {{vars.Peer6Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer7 is defined %}interface eth7
 description uplink-to-{{vars.Peer7Name | default(value="dist-4")}}-link1
 ip address {{vars.Peer7Addr}}/31
 no shutdown
\!
{% endif %}{% if vars.Peer8 is defined %}interface eth8
 description uplink-to-{{vars.Peer8Name | default(value="dist-4")}}-link2
 ip address {{vars.Peer8Addr}}/31
 no shutdown
\!
{% endif %}
router bgp {{vars.ASN}}
 bgp router-id {{vars.Loopback}}
 no bgp ebgp-requires-policy
 no bgp network import-check
{% if vars.Peer1 is defined %} neighbor {{vars.Peer1}} remote-as {{vars.Peer1ASN}}
 neighbor {{vars.Peer1}} description {{vars.Peer1Name | default(value="dist-1")}}
{% endif %}{% if vars.Peer2 is defined %} neighbor {{vars.Peer2}} remote-as {{vars.Peer2ASN}}
 neighbor {{vars.Peer2}} description {{vars.Peer2Name | default(value="dist-1")}}
{% endif %}{% if vars.Peer3 is defined %} neighbor {{vars.Peer3}} remote-as {{vars.Peer3ASN}}
 neighbor {{vars.Peer3}} description {{vars.Peer3Name | default(value="dist-2")}}
{% endif %}{% if vars.Peer4 is defined %} neighbor {{vars.Peer4}} remote-as {{vars.Peer4ASN}}
 neighbor {{vars.Peer4}} description {{vars.Peer4Name | default(value="dist-2")}}
{% endif %}{% if vars.Peer5 is defined %} neighbor {{vars.Peer5}} remote-as {{vars.Peer5ASN}}
 neighbor {{vars.Peer5}} description {{vars.Peer5Name | default(value="dist-3")}}
{% endif %}{% if vars.Peer6 is defined %} neighbor {{vars.Peer6}} remote-as {{vars.Peer6ASN}}
 neighbor {{vars.Peer6}} description {{vars.Peer6Name | default(value="dist-3")}}
{% endif %}{% if vars.Peer7 is defined %} neighbor {{vars.Peer7}} remote-as {{vars.Peer7ASN}}
 neighbor {{vars.Peer7}} description {{vars.Peer7Name | default(value="dist-4")}}
{% endif %}{% if vars.Peer8 is defined %} neighbor {{vars.Peer8}} remote-as {{vars.Peer8ASN}}
 neighbor {{vars.Peer8}} description {{vars.Peer8Name | default(value="dist-4")}}
{% endif %}
 address-family ipv4 unicast
  redistribute connected
 exit-address-family
\!{% endif %}"#.to_string(),
        },
        DefaultTemplate {
            id: "gobgp-bgp".to_string(),
            name: "GoBGP BGP Default".to_string(),
            description: "GoBGP YAML configuration with BGP global settings".to_string(),
            vendor_id: "gobgp".to_string(),
            content: r#"# ZTP Configuration for {{Hostname}}
# Generated by ZTP Server
# MAC: {{MAC}}
# IP: {{IP}}

global:
  config:
    as: 65000
    router-id: {{IP}}
    port: 179"#.to_string(),
        },
        DefaultTemplate {
            id: "generic-switch".to_string(),
            name: "Generic Switch Template".to_string(),
            description: "A generic template suitable for most network switches".to_string(),
            vendor_id: "".to_string(),
            content: r#"! ZTP Configuration for {{Hostname}}
! Generated by ZTP Server
! MAC: {{MAC}}
! IP: {{IP}}
!
hostname {{Hostname}}
!
interface Vlan1
 ip address {{IP}} {{Subnet}}
 no shutdown
!
ip default-gateway {{Gateway}}
!
username admin privilege 15 secret admin
!
line vty 0 4
 login local
 transport input ssh
!
end"#.to_string(),
        },
    ]
}

struct DefaultTemplate {
    id: String,
    name: String,
    description: String,
    vendor_id: String,
    content: String,
}

struct DefaultDhcpOption {
    id: String,
    option_number: i32,
    name: String,
    value: String,
    option_type: String,
    vendor_id: String,
    description: String,
    enabled: bool,
}

fn get_default_dhcp_options_internal() -> Vec<DefaultDhcpOption> {
    vec![
        DefaultDhcpOption {
            id: "tftp-server".to_string(),
            option_number: 66,
            name: "TFTP Server".to_string(),
            value: "${tftp_server_ip}".to_string(),
            option_type: "ip".to_string(),
            vendor_id: "".to_string(),
            description: "TFTP server for config files".to_string(),
            enabled: true,
        },
        DefaultDhcpOption {
            id: "tftp-cisco-150".to_string(),
            option_number: 150,
            name: "Cisco TFTP (Option 150)".to_string(),
            value: "${tftp_server_ip}".to_string(),
            option_type: "ip".to_string(),
            vendor_id: "cisco".to_string(),
            description: "Cisco-specific TFTP server option".to_string(),
            enabled: true,
        },
        DefaultDhcpOption {
            id: "bootfile-cisco".to_string(),
            option_number: 67,
            name: "Cisco Bootfile".to_string(),
            value: "network-confg".to_string(),
            option_type: "string".to_string(),
            vendor_id: "cisco".to_string(),
            description: "Cisco IOS config filename".to_string(),
            enabled: true,
        },
        DefaultDhcpOption {
            id: "bootfile-arista".to_string(),
            option_number: 67,
            name: "Arista Bootfile".to_string(),
            value: "startup-config".to_string(),
            option_type: "string".to_string(),
            vendor_id: "arista".to_string(),
            description: "Arista EOS config filename".to_string(),
            enabled: true,
        },
        DefaultDhcpOption {
            id: "bootfile-juniper".to_string(),
            option_number: 67,
            name: "Juniper Bootfile".to_string(),
            value: "juniper.conf".to_string(),
            option_type: "string".to_string(),
            vendor_id: "juniper".to_string(),
            description: "Juniper config filename".to_string(),
            enabled: true,
        },
        DefaultDhcpOption {
            id: "bootfile-frr".to_string(),
            option_number: 67,
            name: "FRR Bootfile".to_string(),
            value: "frr.conf".to_string(),
            option_type: "string".to_string(),
            vendor_id: "frr".to_string(),
            description: "FRRouting config filename".to_string(),
            enabled: true,
        },
        DefaultDhcpOption {
            id: "bootfile-gobgp".to_string(),
            option_number: 67,
            name: "GoBGP Bootfile".to_string(),
            value: "gobgpd.conf".to_string(),
            option_type: "string".to_string(),
            vendor_id: "gobgp".to_string(),
            description: "GoBGP YAML config filename".to_string(),
            enabled: true,
        },
        DefaultDhcpOption {
            id: "opengear-ztp".to_string(),
            option_number: 43,
            name: "OpenGear ZTP".to_string(),
            value: "".to_string(),
            option_type: "hex".to_string(),
            vendor_id: "opengear".to_string(),
            description: "OpenGear vendor-specific enrollment options".to_string(),
            enabled: false,
        },
    ]
}

/// Seed data helpers used by the Store during migration

pub(super) fn seed_vendor_params() -> Vec<(String, String, String, String, String, i32, String, String, String, String)> {
    get_default_vendors_internal()
        .into_iter()
        .map(|v| {
            let mac_json = serde_json::to_string(&v.mac_prefixes).unwrap_or_else(|_| "[]".to_string());
            let group_names_json = serde_json::to_string(&v.group_names).unwrap_or_else(|_| "[]".to_string());
            (v.id, v.name, v.backup_command, v.deploy_command, v.diff_command, v.ssh_port, mac_json, v.vendor_class, v.default_template, group_names_json)
        })
        .collect()
}

/// Role template IDs that should be force-updated on startup (INSERT OR REPLACE)
/// These use device variables and may evolve with new features.
const ROLE_TEMPLATE_IDS: &[&str] = &[
    "arista-eos-spine",
    "arista-eos-leaf",
    "arista-eos-external",
    "arista-eos-core",
    "arista-eos-distribution",
    "arista-eos-access",
    "frr-bgp-spine",
    "frr-bgp-leaf",
    "frr-bgp-external",
    "frr-bgp-core",
    "frr-bgp-distribution",
    "frr-bgp-access",
];

pub(super) fn seed_template_params() -> Vec<(String, String, String, String, String)> {
    get_default_templates_internal()
        .into_iter()
        .map(|t| (t.id, t.name, t.description, t.vendor_id, t.content))
        .collect()
}

pub(super) fn is_role_template(id: &str) -> bool {
    ROLE_TEMPLATE_IDS.contains(&id)
}

pub(super) fn seed_dhcp_option_params() -> Vec<(String, i32, String, String, String, String, String, bool)> {
    get_default_dhcp_options_internal()
        .into_iter()
        .map(|o| (o.id, o.option_number, o.name, o.value, o.option_type, o.vendor_id, o.description, o.enabled))
        .collect()
}

/// Get default vendors as models (for API)
pub fn get_default_vendors_models() -> Vec<Vendor> {
    let now = Utc::now();
    get_default_vendors_internal()
        .into_iter()
        .enumerate()
        .map(|(i, v)| Vendor {
            id: (i + 1) as i64,
            name: v.name,
            backup_command: v.backup_command,
            deploy_command: v.deploy_command,
            diff_command: v.diff_command,
            ssh_port: v.ssh_port,
            ssh_user: None,
            ssh_pass: None,
            mac_prefixes: v.mac_prefixes,
            vendor_class: v.vendor_class,
            default_template: v.default_template,
            group_names: v.group_names,
            device_count: None,
            created_at: now,
            updated_at: now,
        })
        .collect()
}

struct DefaultVendorAction {
    id: String,
    vendor_id: String,
    label: String,
    command: String,
    sort_order: i32,
    action_type: String,
    webhook_url: String,
    webhook_method: String,
    webhook_headers: String,
    webhook_body: String,
}

impl DefaultVendorAction {
    fn ssh(id: &str, vendor_id: &str, label: &str, command: &str, sort_order: i32) -> Self {
        Self {
            id: id.into(), vendor_id: vendor_id.into(), label: label.into(),
            command: command.into(), sort_order,
            action_type: "ssh".into(), webhook_url: String::new(),
            webhook_method: "POST".into(), webhook_headers: "{}".into(),
            webhook_body: String::new(),
        }
    }

    fn webhook(id: &str, vendor_id: &str, label: &str, sort_order: i32, method: &str, url: &str) -> Self {
        Self {
            id: id.into(), vendor_id: vendor_id.into(), label: label.into(),
            command: String::new(), sort_order,
            action_type: "webhook".into(), webhook_url: url.into(),
            webhook_method: method.into(), webhook_headers: "{}".into(),
            webhook_body: String::new(),
        }
    }
}

fn get_default_vendor_actions_internal() -> Vec<DefaultVendorAction> {
    let ssh = DefaultVendorAction::ssh;
    vec![
        // Arista actions
        ssh("arista-show-version", "arista", "Show Version", "show version", 0),
        ssh("arista-show-version-json", "arista", "Show Version (JSON)", "show version | json", 1),
        ssh("arista-interfaces", "arista", "Interfaces", "show ip interface brief", 2),
        ssh("arista-interfaces-json", "arista", "Interfaces (JSON)", "show ip interface brief | json", 3),
        ssh("arista-running-config", "arista", "Running Config", "show running-config", 4),
        ssh("arista-bgp-summary", "arista", "BGP Summary", "show ip bgp summary", 5),
        ssh("arista-bgp-summary-json", "arista", "BGP Summary (JSON)", "show ip bgp summary | json", 6),
        ssh("arista-lldp-neighbors", "arista", "LLDP Neighbors", "show lldp neighbors", 7),
        ssh("arista-lldp-neighbors-json", "arista", "LLDP Neighbors (JSON)", "show lldp neighbors | json", 8),
        ssh("arista-inventory", "arista", "Inventory", "show inventory", 9),
        ssh("arista-inventory-json", "arista", "Inventory (JSON)", "show inventory | json", 10),
        DefaultVendorAction::webhook("arista-healthcheck", "arista", "API Healthcheck", 99, "GET", "http://localhost:3000/api/health"),
        // Cisco actions
        ssh("cisco-show-version", "cisco", "Show Version", "show version", 0),
        ssh("cisco-interfaces", "cisco", "Interfaces", "show ip int brief", 1),
        ssh("cisco-running-config", "cisco", "Running Config", "show running-config", 2),
        ssh("cisco-cdp-neighbors", "cisco", "CDP Neighbors", "show cdp neighbors", 3),
        // Juniper actions
        ssh("juniper-show-version", "juniper", "Show Version", "show version", 0),
        ssh("juniper-interfaces", "juniper", "Interfaces", "show interfaces terse", 1),
        ssh("juniper-configuration", "juniper", "Configuration", "show configuration | display set", 2),
        // FRR actions
        ssh("frr-show-version", "frr", "Show Version", "vtysh -c 'show version'", 0),
        ssh("frr-running-config", "frr", "Running Config", "vtysh -c 'show running-config'", 1),
        ssh("frr-interfaces", "frr", "Interfaces", "vtysh -c 'show interface brief'", 2),
        ssh("frr-bgp-summary", "frr", "BGP Summary", "vtysh -c 'show ip bgp summary'", 3),
        ssh("frr-bgp-neighbors", "frr", "BGP Neighbors", "vtysh -c 'show ip bgp neighbor'", 4),
        ssh("frr-route-table", "frr", "Route Table", "vtysh -c 'show ip route'", 5),
        ssh("frr-bgp-routes", "frr", "BGP Routes", "vtysh -c 'show ip bgp'", 6),
    ]
}

// ============================================================
// Default Output Parsers
// ============================================================

/// Output parser seed: (name, description, pattern, extract_names, action_id_to_link)
/// action_id_to_link is used post-insert to set output_parser_id on the vendor action.
pub(super) struct DefaultOutputParser {
    pub name: &'static str,
    pub description: &'static str,
    pub pattern: &'static str,
    pub extract_names: &'static str,
    pub action_id: &'static str,
}

pub(super) fn seed_output_parser_data() -> Vec<DefaultOutputParser> {
    vec![
        // Arista "show ip interface brief"
        // Example output:
        //   Interface         IP Address     Status     Protocol        MTU    Owner
        //   Ethernet1         10.0.0.1/24    up         up             1500
        //   Management1       192.168.1.1/24 up         up             1500
        DefaultOutputParser {
            name: "Arista Interface Brief",
            description: "Parses 'show ip interface brief' tabular output",
            pattern: r"^(\S+)\s+(\d+\.\d+\.\d+\.\d+/\d+)\s+(\S+)\s+(\S+)\s+(\d+)",
            extract_names: "interface,ip_address,status,protocol,mtu",
            action_id: "arista-interfaces",
        },
        // Arista "show ip bgp summary"
        // Example output:
        //   Neighbor     V  AS      MsgRcvd  MsgSent  InQ  OutQ  Up/Down    State/PfxRcd
        //   10.0.0.2     4  65001   1234     5678     0    0     01:23:45   100
        DefaultOutputParser {
            name: "Arista BGP Summary",
            description: "Parses 'show ip bgp summary' tabular output",
            pattern: r"^(\d+\.\d+\.\d+\.\d+)\s+(\d)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)",
            extract_names: "neighbor,version,as,msg_rcvd,msg_sent,in_q,out_q,up_down,state_pfx",
            action_id: "arista-bgp-summary",
        },
        // Arista "show lldp neighbors"
        // Example output:
        //   Port       Neighbor Device ID   Neighbor Port ID   TTL
        //   Et1        spine1.lab           Ethernet2          120
        //   Ma1        switch2              Management1        120
        DefaultOutputParser {
            name: "Arista LLDP Neighbors",
            description: "Parses 'show lldp neighbors' tabular output",
            pattern: r"^(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s*$",
            extract_names: "port,neighbor_device,neighbor_port,ttl",
            action_id: "arista-lldp-neighbors",
        },
        // Arista "show inventory"
        // Example output (System Information section rows):
        //   NAME: "Chassis"     , DESCR: "Arista Networks DCS-7050CX3-32S"
        //   PID: DCS-7050CX3-32S    , VID: 02.00, SN: JPE12345678
        // We parse the PID/VID/SN lines since those have the structured fields
        DefaultOutputParser {
            name: "Arista Inventory",
            description: "Parses 'show inventory' PID/VID/SN lines",
            pattern: r"PID:\s*(\S+)\s*,\s*VID:\s*(\S+)\s*,\s*SN:\s*(\S+)",
            extract_names: "pid,vid,serial_number",
            action_id: "arista-inventory",
        },
    ]
}

pub(super) fn seed_vendor_action_params() -> Vec<(String, String, String, String, i32, String, String, String, String, String)> {
    get_default_vendor_actions_internal()
        .into_iter()
        .map(|a| (a.id, a.vendor_id, a.label, a.command, a.sort_order, a.action_type, a.webhook_url, a.webhook_method, a.webhook_headers, a.webhook_body))
        .collect()
}

/// Map an old text action ID (e.g. "arista-interfaces") to its label ("Interfaces")
pub(super) fn action_id_to_label(old_id: &str) -> Option<String> {
    for action in get_default_vendor_actions_internal() {
        if action.id == old_id {
            return Some(action.label);
        }
    }
    None
}

pub(super) fn seed_device_model_params() -> Vec<(String, String, String, String, i32, String)> {
    // Helper to build port JSON arrays
    fn ports_json(count: usize, col_start: usize, name_fn: &dyn Fn(usize) -> String, connector: &str, speed: u32) -> Vec<String> {
        (0..count).map(|i| {
            format!(r#"{{"col":{},"vendor_port_name":"{}","connector":"{}","speed":{}}}"#,
                col_start + i, name_fn(i), connector, speed)
        }).collect()
    }

    // Arista 7050CX3-32S: 32x QSFP28 100G + 2x SFP+ 10G + Management
    let cx3_top: Vec<String> = ports_json(16, 1, &|i| format!("Ethernet{}", i * 2 + 1), "qsfp28", 100000);
    let cx3_bot: Vec<String> = ports_json(16, 1, &|i| format!("Ethernet{}", i * 2 + 2), "qsfp28", 100000);
    let cx3_layout = format!(
        r#"[{{"row":1,"sections":[{{"label":"QSFP28 100G","ports":[{}]}}]}},{{"row":2,"sections":[{{"label":"QSFP28 100G","ports":[{}]}},{{"label":"SFP+ 10G","ports":[{{"col":18,"vendor_port_name":"Ethernet33","connector":"sfp+","speed":10000}},{{"col":19,"vendor_port_name":"Ethernet34","connector":"sfp+","speed":10000}}]}},{{"label":"Management","ports":[{{"col":21,"vendor_port_name":"Management1","connector":"rj45","speed":1000,"role":"mgmt"}}]}}]}}]"#,
        cx3_top.join(","), cx3_bot.join(",")
    );

    // Arista 7050SX3-48YC8: 48x SFP28 25G + 8x QSFP28 100G + Management
    let sx3_sfp_top: Vec<String> = ports_json(24, 1, &|i| format!("Ethernet{}", i * 2 + 1), "sfp28", 25000);
    let sx3_qsfp_top: Vec<String> = ports_json(4, 26, &|i| format!("Ethernet{}", 49 + i * 2), "qsfp28", 100000);
    let sx3_sfp_bot: Vec<String> = ports_json(24, 1, &|i| format!("Ethernet{}", i * 2 + 2), "sfp28", 25000);
    let sx3_qsfp_bot: Vec<String> = ports_json(4, 26, &|i| format!("Ethernet{}", 50 + i * 2), "qsfp28", 100000);
    let sx3_layout = format!(
        r#"[{{"row":1,"sections":[{{"label":"SFP28 25G","ports":[{}]}},{{"label":"QSFP28 100G","ports":[{}]}}]}},{{"row":2,"sections":[{{"label":"SFP28 25G","ports":[{}]}},{{"label":"QSFP28 100G","ports":[{}]}},{{"label":"Management","ports":[{{"col":31,"vendor_port_name":"Management1","connector":"rj45","speed":1000,"role":"mgmt"}}]}}]}}]"#,
        sx3_sfp_top.join(","), sx3_qsfp_top.join(","),
        sx3_sfp_bot.join(","), sx3_qsfp_bot.join(",")
    );

    // Arista 7020TR-48: 48x RJ45 1G + 6x SFP+ 10G + Management
    let tr_rj45_top: Vec<String> = ports_json(24, 1, &|i| format!("Ethernet{}", i * 2 + 1), "rj45", 1000);
    let tr_sfp_top: Vec<String> = ports_json(3, 26, &|i| format!("Ethernet{}", 49 + i * 2), "sfp+", 10000);
    let tr_rj45_bot: Vec<String> = ports_json(24, 1, &|i| format!("Ethernet{}", i * 2 + 2), "rj45", 1000);
    let tr_sfp_bot: Vec<String> = ports_json(3, 26, &|i| format!("Ethernet{}", 50 + i * 2), "sfp+", 10000);
    let tr_layout = format!(
        r#"[{{"row":1,"sections":[{{"label":"RJ45 1G","ports":[{}]}},{{"label":"SFP+ 10G","ports":[{}]}}]}},{{"row":2,"sections":[{{"label":"RJ45 1G","ports":[{}]}},{{"label":"SFP+ 10G","ports":[{}]}},{{"label":"Management","ports":[{{"col":30,"vendor_port_name":"Management1","connector":"rj45","speed":1000,"role":"mgmt"}}]}}]}}]"#,
        tr_rj45_top.join(","), tr_sfp_top.join(","),
        tr_rj45_bot.join(","), tr_sfp_bot.join(",")
    );

    // PP-24-RJ45: 1U, single row of 24 rj45 1G
    let pp_24_rj45: Vec<String> = ports_json(24, 1, &|i| format!("Port {}", i + 1), "rj45", 1000);
    let pp_24_rj45_layout = format!(
        r#"[{{"row":1,"sections":[{{"label":"RJ45 1G","ports":[{}]}}]}}]"#,
        pp_24_rj45.join(",")
    );

    // PP-48-RJ45: 2U, two rows of 24 rj45 1G, odd ports top, even ports bottom
    let pp_48_rj45_top: Vec<String> = ports_json(24, 1, &|i| format!("Port {}", i * 2 + 1), "rj45", 1000);
    let pp_48_rj45_bot: Vec<String> = ports_json(24, 1, &|i| format!("Port {}", i * 2 + 2), "rj45", 1000);
    let pp_48_rj45_layout = format!(
        r#"[{{"row":1,"sections":[{{"label":"RJ45 1G","ports":[{}]}}]}},{{"row":2,"sections":[{{"label":"RJ45 1G","ports":[{}]}}]}}]"#,
        pp_48_rj45_top.join(","), pp_48_rj45_bot.join(",")
    );

    // PP-24-LC: 1U, single row of 24 sfp 10G
    let pp_24_lc: Vec<String> = ports_json(24, 1, &|i| format!("Port {}", i + 1), "sfp", 10000);
    let pp_24_lc_layout = format!(
        r#"[{{"row":1,"sections":[{{"label":"LC Fiber 10G","ports":[{}]}}]}}]"#,
        pp_24_lc.join(",")
    );

    // PP-48-LC: 2U, two rows of 24 sfp 10G
    let pp_48_lc_top: Vec<String> = ports_json(24, 1, &|i| format!("Port {}", i * 2 + 1), "sfp", 10000);
    let pp_48_lc_bot: Vec<String> = ports_json(24, 1, &|i| format!("Port {}", i * 2 + 2), "sfp", 10000);
    let pp_48_lc_layout = format!(
        r#"[{{"row":1,"sections":[{{"label":"LC Fiber 10G","ports":[{}]}}]}},{{"row":2,"sections":[{{"label":"LC Fiber 10G","ports":[{}]}}]}}]"#,
        pp_48_lc_top.join(","), pp_48_lc_bot.join(",")
    );

    // PP-24-SC: 1U, single row of 24 sfp 10G
    let pp_24_sc: Vec<String> = ports_json(24, 1, &|i| format!("Port {}", i + 1), "sfp", 10000);
    let pp_24_sc_layout = format!(
        r#"[{{"row":1,"sections":[{{"label":"SC Fiber 10G","ports":[{}]}}]}}]"#,
        pp_24_sc.join(",")
    );

    // PP-12-MPO: 1U, single row of 12 qsfp28 100G
    let pp_12_mpo: Vec<String> = ports_json(12, 1, &|i| format!("Port {}", i + 1), "qsfp28", 100000);
    let pp_12_mpo_layout = format!(
        r#"[{{"row":1,"sections":[{{"label":"MPO 100G","ports":[{}]}}]}}]"#,
        pp_12_mpo.join(",")
    );

    // PP-192-RJ45: 8U, 8 rows of 24 rj45 1G = 192 ports
    let mut pp_192_rows = Vec::new();
    for row_num in 0..8u32 {
        let row_ports: Vec<String> = ports_json(24, 1, &|i| format!("Port {}", row_num * 24 + i as u32 + 1), "rj45", 1000);
        pp_192_rows.push(format!(
            r#"{{"row":{},"sections":[{{"label":"RJ45 1G","ports":[{}]}}]}}"#,
            row_num + 1, row_ports.join(",")
        ));
    }
    let pp_192_rj45_layout = format!("[{}]", pp_192_rows.join(","));

    // AMD MI300X/MI325X 8-GPU Node: 2x QSFP-DD 400G uplinks + 8x OSFP 400G fabric + Management
    let gpu_uplink_ports = r#"{"col":1,"vendor_port_name":"Ethernet1","connector":"qsfp-dd","speed":400000,"role":"uplink"},{"col":2,"vendor_port_name":"Ethernet2","connector":"qsfp-dd","speed":400000,"role":"uplink"}"#;
    let gpu_fabric_ports: Vec<String> = (1..=8).map(|i| {
        format!(r#"{{"col":{},"vendor_port_name":"IB{}","connector":"osfp","speed":400000,"role":"lateral"}}"#, i, i)
    }).collect();
    let gpu_layout = format!(
        r#"[{{"row":1,"sections":[{{"label":"QSFP-DD 400G","ports":[{}]}}]}},{{"row":2,"sections":[{{"label":"OSFP 400G","ports":[{}]}}]}},{{"row":3,"sections":[{{"label":"Management","ports":[{{"col":1,"vendor_port_name":"Management1","connector":"rj45","speed":1000,"role":"mgmt"}}]}}]}}]"#,
        gpu_uplink_ports, gpu_fabric_ports.join(",")
    );

    vec![
        ("arista-7050cx3-32s".into(), "arista".into(), "7050CX3-32S".into(), "Arista 7050CX3-32S".into(), 1, cx3_layout),
        ("arista-7050sx3-48yc8".into(), "arista".into(), "7050SX3-48YC8".into(), "Arista 7050SX3-48YC8".into(), 1, sx3_layout.clone()),
        ("arista-7280sr3-48yc8".into(), "arista".into(), "7280SR3-48YC8".into(), "Arista 7280SR3-48YC8".into(), 1, sx3_layout.clone()),
        ("arista-7280r3".into(), "arista".into(), "7280R3".into(), "Arista 7280R3".into(), 1, sx3_layout),
        ("arista-7020tr-48".into(), "arista".into(), "7020TR-48".into(), "Arista 7020TR-48".into(), 1, tr_layout),
        // AMD GPU node models
        ("amd-mi300x".into(), "amd".into(), "MI300X 8-GPU Node".into(), "AMD Instinct MI300X 8-GPU Node".into(), 4, gpu_layout.clone()),
        ("amd-mi325x".into(), "amd".into(), "MI325X 8-GPU Node".into(), "AMD Instinct MI325X 8-GPU Node".into(), 4, gpu_layout.clone()),
        ("amd-mi350x".into(), "amd".into(), "MI350X 8-GPU Node".into(), "AMD Instinct MI350X (Helios) 8-GPU Node".into(), 4, gpu_layout),
        // Patch panel models
        ("pp-24-rj45".into(), "patch-panel".into(), "PP-24-RJ45".into(), "24-Port RJ45 Patch Panel".into(), 1, pp_24_rj45_layout),
        ("pp-48-rj45".into(), "patch-panel".into(), "PP-48-RJ45".into(), "48-Port RJ45 Patch Panel".into(), 2, pp_48_rj45_layout),
        ("pp-24-lc".into(), "patch-panel".into(), "PP-24-LC".into(), "24-Port LC Fiber Patch Panel".into(), 1, pp_24_lc_layout),
        ("pp-48-lc".into(), "patch-panel".into(), "PP-48-LC".into(), "48-Port LC Fiber Patch Panel".into(), 2, pp_48_lc_layout),
        ("pp-24-sc".into(), "patch-panel".into(), "PP-24-SC".into(), "24-Port SC Fiber Patch Panel".into(), 1, pp_24_sc_layout),
        ("pp-12-mpo".into(), "patch-panel".into(), "PP-12-MPO".into(), "12-Port MPO Fiber Patch Panel".into(), 1, pp_12_mpo_layout),
        ("pp-192-rj45".into(), "patch-panel".into(), "PP-192-RJ45".into(), "192-Port RJ45 Patch Panel".into(), 8, pp_192_rj45_layout),
    ]
}

/// Default IPAM supernets that must exist for the virtual CLOS builder.
/// Returns Vec of (prefix, description, is_supernet) tuples.
pub fn get_default_ipam_supernets() -> Vec<(&'static str, &'static str, bool)> {
    vec![
        ("10.0.0.0/8", "Infrastructure Supernet", true),
    ]
}

/// Get default DHCP options as models (for API)
pub fn get_default_dhcp_options_models() -> Vec<DhcpOption> {
    let now = Utc::now();
    get_default_dhcp_options_internal()
        .into_iter()
        .enumerate()
        .map(|(i, o)| DhcpOption {
            id: (i + 1) as i64,
            option_number: o.option_number,
            name: o.name,
            value: o.value,
            option_type: o.option_type,
            vendor_id: None, // vendor_id lookup requires DB; defaults use None
            description: if o.description.is_empty() { None } else { Some(o.description) },
            enabled: o.enabled,
            created_at: now,
            updated_at: now,
        })
        .collect()
}

# Network Security Comprehensive Guide

## Metadata
- **Category**: Infrastructure Security
- **Audience**: Network engineers, security engineers, DevOps engineers
- **Last Updated**: 2026-03-10
- **Complexity**: Advanced
- **Technologies Covered**: iptables, nftables, WireGuard, IPSec, Istio, Linkerd, Suricata, Snort, DNSSEC

---

## 1. Network Segmentation

Network segmentation divides a network into isolated zones, limiting the blast radius
of a breach and restricting lateral movement. The three foundational concepts are
DMZ architecture, internal zone separation, and microsegmentation.

### 1.1 DMZ Architecture

The Demilitarized Zone (DMZ) is a perimeter network segment between the public internet
and the internal network. Only publicly accessible services (load balancers, web servers,
API gateways) reside in the DMZ.

```
Internet
    |
[Firewall - External]
    |
[DMZ] -- Load Balancers, WAF, Reverse Proxies
    |
[Firewall - Internal]
    |
[Application Zone] -- App Servers, Middleware
    |
[Firewall - Database]
    |
[Data Zone] -- Databases, File Stores
    |
[Management Zone] -- Bastion Hosts, Monitoring, CI/CD
```

### 1.2 Internal Zone Separation

Separate internal networks by function, sensitivity, and environment.

```hcl
# Terraform - AWS VPC with multiple subnets for zone separation
resource "aws_vpc" "production" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
}

# DMZ - Public facing (load balancers only)
resource "aws_subnet" "dmz_a" {
  vpc_id            = aws_vpc.production.id
  cidr_block        = "10.0.0.0/24"
  availability_zone = "us-east-1a"
  tags = { Name = "dmz-a", Zone = "dmz" }
}

resource "aws_subnet" "dmz_b" {
  vpc_id            = aws_vpc.production.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1b"
  tags = { Name = "dmz-b", Zone = "dmz" }
}

# Application tier - private subnet
resource "aws_subnet" "app_a" {
  vpc_id            = aws_vpc.production.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "us-east-1a"
  tags = { Name = "app-a", Zone = "application" }
}

resource "aws_subnet" "app_b" {
  vpc_id            = aws_vpc.production.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "us-east-1b"
  tags = { Name = "app-b", Zone = "application" }
}

# Database tier - isolated subnet (no NAT gateway, no internet)
resource "aws_subnet" "db_a" {
  vpc_id            = aws_vpc.production.id
  cidr_block        = "10.0.100.0/24"
  availability_zone = "us-east-1a"
  tags = { Name = "db-a", Zone = "data" }
}

resource "aws_subnet" "db_b" {
  vpc_id            = aws_vpc.production.id
  cidr_block        = "10.0.101.0/24"
  availability_zone = "us-east-1b"
  tags = { Name = "db-b", Zone = "data" }
}

# Management subnet
resource "aws_subnet" "mgmt" {
  vpc_id            = aws_vpc.production.id
  cidr_block        = "10.0.200.0/24"
  availability_zone = "us-east-1a"
  tags = { Name = "management", Zone = "management" }
}
```

### 1.3 Microsegmentation

Microsegmentation applies security policies at the individual workload level, not just
the subnet level. This is the foundation of zero trust networking.

```yaml
# Kubernetes NetworkPolicy for microsegmentation
# Each service gets its own policy defining exact allowed communication
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-service-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: payment-service
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: order-service
      ports:
        - protocol: TCP
          port: 8443
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: payment-database
      ports:
        - protocol: TCP
          port: 5432
    - to:  # Allow DNS
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
    - to:  # Allow external payment provider
        - ipBlock:
            cidr: 198.51.100.0/24
      ports:
        - protocol: TCP
          port: 443
```

---

## 2. Firewall Configuration

### 2.1 iptables

```bash
#!/bin/bash
# Production server iptables configuration
# Flush existing rules
iptables -F
iptables -X
iptables -Z

# Set default policies to DROP
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established and related connections
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow SSH from management network only
iptables -A INPUT -p tcp --dport 22 -s 10.0.200.0/24 -m conntrack --ctstate NEW -j ACCEPT

# Allow HTTPS inbound
iptables -A INPUT -p tcp --dport 443 -m conntrack --ctstate NEW -j ACCEPT

# Allow HTTP for redirect to HTTPS only
iptables -A INPUT -p tcp --dport 80 -m conntrack --ctstate NEW -j ACCEPT

# Rate limit new SSH connections (brute force protection)
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \
  -m recent --set --name SSH
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \
  -m recent --update --seconds 60 --hitcount 4 --name SSH -j DROP

# Allow outbound DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# Allow outbound HTTPS (for updates, APIs)
iptables -A OUTPUT -p tcp --dport 443 -m conntrack --ctstate NEW -j ACCEPT

# Allow outbound NTP
iptables -A OUTPUT -p udp --dport 123 -j ACCEPT

# Log dropped packets
iptables -A INPUT -m limit --limit 5/min -j LOG \
  --log-prefix "iptables-INPUT-DROP: " --log-level 4
iptables -A OUTPUT -m limit --limit 5/min -j LOG \
  --log-prefix "iptables-OUTPUT-DROP: " --log-level 4

# Drop invalid packets
iptables -A INPUT -m conntrack --ctstate INVALID -j DROP

# Anti-spoofing
iptables -A INPUT -s 127.0.0.0/8 ! -i lo -j DROP
iptables -A INPUT -s 0.0.0.0/8 -j DROP
iptables -A INPUT -s 169.254.0.0/16 -j DROP
iptables -A INPUT -s 224.0.0.0/4 -j DROP
iptables -A INPUT -s 240.0.0.0/4 -j DROP

# Save rules
iptables-save > /etc/iptables/rules.v4
```

### 2.2 nftables

```
#!/usr/sbin/nft -f
# nftables production configuration

flush ruleset

table inet filter {
    set management_nets {
        type ipv4_addr
        flags interval
        elements = { 10.0.200.0/24, 192.168.100.0/24 }
    }

    set blocked_ips {
        type ipv4_addr
        flags interval, timeout
        timeout 1h
    }

    chain input {
        type filter hook input priority 0; policy drop;

        # Connection tracking
        ct state established,related accept
        ct state invalid drop

        # Loopback
        iifname "lo" accept

        # Block known bad actors
        ip saddr @blocked_ips drop

        # ICMP rate limiting
        ip protocol icmp icmp type echo-request limit rate 5/second accept

        # SSH from management network with rate limiting
        ip saddr @management_nets tcp dport 22 ct state new \
            limit rate 3/minute accept

        # HTTPS
        tcp dport 443 ct state new accept

        # HTTP (for redirect)
        tcp dport 80 ct state new accept

        # Log everything else
        limit rate 5/minute log prefix "nft-input-drop: " level warn
    }

    chain forward {
        type filter hook forward priority 0; policy drop;
        ct state established,related accept
    }

    chain output {
        type filter hook output priority 0; policy drop;

        # Loopback
        oifname "lo" accept

        # Established connections
        ct state established,related accept

        # DNS
        tcp dport 53 accept
        udp dport 53 accept

        # HTTPS outbound
        tcp dport 443 ct state new accept

        # NTP
        udp dport 123 accept

        # Log drops
        limit rate 5/minute log prefix "nft-output-drop: " level warn
    }
}
```

### 2.3 Cloud Security Groups

```hcl
# AWS Security Groups - layered architecture
# ALB Security Group
resource "aws_security_group" "alb" {
  name_prefix = "alb-"
  vpc_id      = aws_vpc.production.id

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP for redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description     = "To application servers"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}

# Application Security Group
resource "aws_security_group" "app" {
  name_prefix = "app-"
  vpc_id      = aws_vpc.production.id

  ingress {
    description     = "From ALB only"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description     = "To database"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.db.id]
  }

  egress {
    description     = "To Redis"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.cache.id]
  }

  egress {
    description = "HTTPS outbound for external APIs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Database Security Group
resource "aws_security_group" "db" {
  name_prefix = "db-"
  vpc_id      = aws_vpc.production.id

  ingress {
    description     = "PostgreSQL from app servers only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # No egress rules = no outbound access (most restrictive)
}
```

---

## 3. VPN Configuration

### 3.1 WireGuard

```ini
# WireGuard Server Configuration - /etc/wireguard/wg0.conf
[Interface]
Address = 10.200.0.1/24
ListenPort = 51820
PrivateKey = <server-private-key>

# Post-up: enable IP forwarding and set firewall rules
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; \
         iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; \
         sysctl -w net.ipv4.ip_forward=1
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; \
           iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# DNS server for VPN clients
DNS = 10.200.0.1

# Peer: Developer workstation
[Peer]
PublicKey = <peer-public-key>
AllowedIPs = 10.200.0.2/32
PresharedKey = <preshared-key>

# Peer: CI/CD runner
[Peer]
PublicKey = <runner-public-key>
AllowedIPs = 10.200.0.10/32
PresharedKey = <preshared-key>
```

```ini
# WireGuard Client Configuration
[Interface]
Address = 10.200.0.2/24
PrivateKey = <client-private-key>
DNS = 10.200.0.1

[Peer]
PublicKey = <server-public-key>
PresharedKey = <preshared-key>
Endpoint = vpn.example.com:51820
# Only route internal traffic through VPN (split tunnel)
AllowedIPs = 10.0.0.0/8, 172.16.0.0/12
PersistentKeepalive = 25
```

### 3.2 IPSec with strongSwan

```ini
# /etc/ipsec.conf - Site-to-site VPN
conn site-to-site
    type=tunnel
    auto=start
    keyexchange=ikev2

    # Local side
    left=%defaultroute
    leftid=@vpn-east.example.com
    leftcert=vpn-east.pem
    leftsubnet=10.0.0.0/16

    # Remote side
    right=203.0.113.50
    rightid=@vpn-west.example.com
    rightcert=vpn-west.pem
    rightsubnet=10.1.0.0/16

    # Encryption settings
    ike=aes256gcm16-sha384-ecp384!
    esp=aes256gcm16-sha384-ecp384!

    # Dead peer detection
    dpdaction=restart
    dpddelay=30s
    dpdtimeout=120s

    # Lifetime
    ikelifetime=8h
    lifetime=1h
    margintime=10m
```

---

## 4. Service Mesh with mTLS

### 4.1 Istio mTLS Configuration

```yaml
# Istio - Enforce strict mTLS mesh-wide
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT

---
# Istio DestinationRule - configure mTLS for specific services
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: payment-service
  namespace: production
spec:
  host: payment-service.production.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: DEFAULT
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 60s

---
# Istio AuthorizationPolicy - service-to-service access control
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: payment-service-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: payment-service
  action: ALLOW
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/production/sa/order-service"
      to:
        - operation:
            methods: ["POST"]
            paths: ["/api/v1/payments"]
    - from:
        - source:
            principals:
              - "cluster.local/ns/production/sa/refund-service"
      to:
        - operation:
            methods: ["POST"]
            paths: ["/api/v1/refunds"]
```

### 4.2 Linkerd mTLS

```yaml
# Linkerd - mTLS is enabled by default for all meshed services
# Annotate namespace to inject Linkerd proxy automatically
apiVersion: v1
kind: Namespace
metadata:
  name: production
  annotations:
    linkerd.io/inject: enabled

---
# Linkerd ServerAuthorization - restrict access
apiVersion: policy.linkerd.io/v1beta1
kind: ServerAuthorization
metadata:
  name: payment-service-auth
  namespace: production
spec:
  server:
    name: payment-service
  client:
    meshTLS:
      serviceAccounts:
        - name: order-service
        - name: refund-service
```

---

## 5. DNS Security

### 5.1 DNSSEC

DNSSEC adds cryptographic signatures to DNS records, preventing DNS spoofing and
cache poisoning attacks.

```bash
# Generate DNSSEC keys for a zone
dnssec-keygen -a ECDSAP384SHA384 -b 384 -n ZONE example.com    # ZSK
dnssec-keygen -a ECDSAP384SHA384 -b 384 -n ZONE -f KSK example.com  # KSK

# Sign the zone
dnssec-signzone -A -3 $(head -c 1000 /dev/urandom | sha256sum | cut -c1-16) \
  -N INCREMENT -o example.com -t example.com.zone

# Verify DNSSEC for a domain
dig +dnssec example.com A
dig +dnssec +cd example.com DNSKEY
delv @8.8.8.8 example.com A +rtrace
```

### 5.2 DNS over HTTPS (DoH) and DNS over TLS (DoT)

```yaml
# CoreDNS configuration with DoT upstream and DNSSEC validation
# Corefile
.:53 {
    forward . tls://1.1.1.1 tls://1.0.0.1 {
        tls_servername cloudflare-dns.com
        health_check 10s
    }
    dnssec
    cache 300
    log
    errors
    prometheus :9153
}

# Internal zone
internal.example.com:53 {
    file /etc/coredns/internal.example.com.zone
    dnssec {
        key file /etc/coredns/keys/Kinternal.example.com
    }
    log
    errors
}
```

### 5.3 DNS Filtering

```yaml
# Pi-hole or CoreDNS blocklist for malicious domains
# CoreDNS with hosts plugin for DNS filtering
.:53 {
    hosts /etc/coredns/blocklist.hosts {
        fallthrough
    }
    forward . tls://1.1.1.1 {
        tls_servername cloudflare-dns.com
    }
    cache 300
    log
}

# blocklist.hosts format
# 0.0.0.0 malware-domain.com
# 0.0.0.0 phishing-site.net
# 0.0.0.0 crypto-miner.io
```

---

## 6. Ingress and Egress Control

### 6.1 Ingress Control

```yaml
# Kubernetes Ingress with strict security headers
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: production
  annotations:
    # Force HTTPS
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"

    # Security headers
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload";
      more_set_headers "X-Content-Type-Options: nosniff";
      more_set_headers "X-Frame-Options: DENY";
      more_set_headers "X-XSS-Protection: 0";
      more_set_headers "Referrer-Policy: strict-origin-when-cross-origin";
      more_set_headers "Content-Security-Policy: default-src 'self'";
      more_set_headers "Permissions-Policy: camera=(), microphone=(), geolocation=()";

    # Rate limiting
    nginx.ingress.kubernetes.io/limit-rps: "50"
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "5"

    # Request size limits
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"

    # WAF integration (ModSecurity)
    nginx.ingress.kubernetes.io/enable-modsecurity: "true"
    nginx.ingress.kubernetes.io/modsecurity-snippet: |
      SecRuleEngine On
      SecRequestBodyAccess On
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.example.com
      secretName: app-tls
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app-service
                port:
                  number: 8080
```

### 6.2 Egress Control

```yaml
# Kubernetes egress NetworkPolicy - restrict outbound traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restrict-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Egress
  egress:
    # DNS
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
    # Database
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    # Specific external API
    - to:
        - ipBlock:
            cidr: 198.51.100.0/24
      ports:
        - protocol: TCP
          port: 443
```

---

## 7. Network Monitoring (IDS/IPS)

### 7.1 Suricata Configuration

```yaml
# /etc/suricata/suricata.yaml (key sections)
vars:
  address-groups:
    HOME_NET: "[10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16]"
    EXTERNAL_NET: "!$HOME_NET"
    HTTP_SERVERS: "[10.0.10.0/24]"
    SQL_SERVERS: "[10.0.100.0/24]"
    DNS_SERVERS: "[10.0.200.10]"

  port-groups:
    HTTP_PORTS: "80"
    SHELLCODE_PORTS: "!80"
    ORACLE_PORTS: 1521
    SSH_PORTS: 22

default-rule-path: /etc/suricata/rules

rule-files:
  - suricata.rules
  - local.rules

# Enable IPS mode (inline)
af-packet:
  - interface: eth0
    cluster-id: 99
    cluster-type: cluster_flow
    defrag: yes
    use-mmap: yes
    tpacket-v3: yes

# Output configuration
outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: eve.json
      types:
        - alert:
            payload: yes
            payload-printable: yes
            http-body: yes
            http-body-printable: yes
        - http:
            extended: yes
        - dns:
            query: yes
            answer: yes
        - tls:
            extended: yes
        - files:
            force-magic: yes
            force-hash: [md5, sha256]
```

```bash
# Custom Suricata rules - /etc/suricata/rules/local.rules

# Detect SSH brute force
alert ssh $EXTERNAL_NET any -> $HOME_NET 22 (msg:"Possible SSH brute force"; \
  flow:to_server; threshold:type both, track by_src, count 5, seconds 60; \
  sid:1000001; rev:1;)

# Detect SQL injection in HTTP
alert http $EXTERNAL_NET any -> $HTTP_SERVERS $HTTP_PORTS (msg:"SQL Injection attempt"; \
  flow:to_server,established; content:"UNION"; nocase; content:"SELECT"; nocase; \
  sid:1000002; rev:1;)

# Detect cryptocurrency mining
alert dns any any -> any any (msg:"Possible crypto mining DNS query"; \
  dns.query; content:"pool."; nocase; content:"mining"; nocase; \
  sid:1000003; rev:1;)

# Detect data exfiltration via DNS
alert dns any any -> any any (msg:"Large DNS TXT query - possible exfiltration"; \
  dns.query; content:"."; offset:50; sid:1000004; rev:1;)
```

### 7.2 Snort Configuration

```
# /etc/snort/snort.conf (key rules)
# Detect port scanning
alert tcp $EXTERNAL_NET any -> $HOME_NET any (msg:"Port scan detected"; \
  flags:S; threshold:type both, track by_src, count 20, seconds 10; \
  classtype:attempted-recon; sid:1000010; rev:1;)

# Detect reverse shell
alert tcp $HOME_NET any -> $EXTERNAL_NET any (msg:"Possible reverse shell"; \
  flow:established; content:"/bin/sh"; sid:1000011; rev:1;)
alert tcp $HOME_NET any -> $EXTERNAL_NET any (msg:"Possible reverse shell"; \
  flow:established; content:"/bin/bash"; sid:1000012; rev:1;)
```

---

## 8. DDoS Mitigation

### 8.1 Network-Level DDoS Protection

```bash
# Linux kernel parameters for DDoS mitigation
# /etc/sysctl.d/99-ddos-protection.conf

# Enable SYN cookies
net.ipv4.tcp_syncookies = 1

# Reduce SYN-ACK retries
net.ipv4.tcp_synack_retries = 2

# Reduce SYN retries
net.ipv4.tcp_syn_retries = 2

# Increase backlog
net.ipv4.tcp_max_syn_backlog = 65536
net.core.somaxconn = 65536
net.core.netdev_max_backlog = 65536

# Disable ICMP redirect acceptance
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0

# Disable source routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Enable reverse path filtering
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP broadcast requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Connection tracking limits
net.netfilter.nf_conntrack_max = 1048576
net.netfilter.nf_conntrack_tcp_timeout_established = 600
```

```bash
# nftables rules for SYN flood protection
table inet ddos_protection {
    chain input {
        type filter hook input priority -10; policy accept;

        # Drop fragmented packets
        ip frag-off & 0x1fff != 0 drop

        # Drop XMAS packets
        tcp flags & (fin|syn|rst|psh|ack|urg) == fin|syn|rst|psh|ack|urg drop

        # Drop NULL packets
        tcp flags & (fin|syn|rst|psh|ack|urg) == 0x0 drop

        # SYN flood protection
        tcp flags syn limit rate 100/second burst 150 packets accept
        tcp flags syn drop

        # ICMP flood protection
        ip protocol icmp limit rate 10/second burst 20 packets accept
        ip protocol icmp drop

        # Connection rate limiting per source IP
        ct state new add @rate_limit { ip saddr limit rate 50/second burst 100 packets }
        ct state new ip saddr @rate_limit drop
    }
}
```

---

## 9. Bastion Hosts and Jump Servers

### 9.1 Bastion Host Configuration

```hcl
# Terraform - Bastion host with minimal access
resource "aws_instance" "bastion" {
  ami                    = "ami-0123456789abcdef0"
  instance_type          = "t3.micro"
  key_name               = aws_key_pair.bastion.key_name
  subnet_id              = aws_subnet.dmz_a.id
  vpc_security_group_ids = [aws_security_group.bastion.id]

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"  # Enforce IMDSv2
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted   = true
    volume_size = 20
  }

  user_data = <<-EOF
    #!/bin/bash
    # Harden SSH
    sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
    sed -i 's/#MaxAuthTries 6/MaxAuthTries 3/' /etc/ssh/sshd_config
    sed -i 's/#ClientAliveInterval 0/ClientAliveInterval 300/' /etc/ssh/sshd_config
    sed -i 's/#ClientAliveCountMax 3/ClientAliveCountMax 2/' /etc/ssh/sshd_config
    echo 'AllowUsers bastion-user' >> /etc/ssh/sshd_config
    systemctl restart sshd

    # Install audit logging
    yum install -y audispd-plugins
    systemctl enable auditd
    EOF

  tags = {
    Name = "bastion-host"
  }
}

resource "aws_security_group" "bastion" {
  name_prefix = "bastion-"
  vpc_id      = aws_vpc.production.id

  ingress {
    description = "SSH from corporate network only"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["203.0.113.0/24"]  # Corporate IP range
  }

  egress {
    description     = "SSH to internal hosts"
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}
```

### 9.2 SSH ProxyJump Configuration

```
# ~/.ssh/config - Use bastion as jump host
Host bastion
    HostName bastion.example.com
    User bastion-user
    IdentityFile ~/.ssh/bastion_key
    ForwardAgent no
    AddKeysToAgent yes

Host internal-*
    ProxyJump bastion
    User admin
    IdentityFile ~/.ssh/internal_key
    ForwardAgent no

Host internal-app-1
    HostName 10.0.10.5

Host internal-db-1
    HostName 10.0.100.5
```

---

## 10. Zero-Trust Networking Principles

### 10.1 East-West Traffic Encryption

All traffic between services must be encrypted, even within the same network segment.

```yaml
# Istio PeerAuthentication - strict mTLS for all mesh traffic
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT
```

### 10.2 Private Endpoints for Cloud Services

```hcl
# AWS PrivateLink endpoint for S3
resource "aws_vpc_endpoint" "s3_interface" {
  vpc_id              = aws_vpc.production.id
  service_name        = "com.amazonaws.us-east-1.s3"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.app_a.id, aws_subnet.app_b.id]
  security_group_ids  = [aws_security_group.vpc_endpoint.id]
  private_dns_enabled = true
}

# AWS PrivateLink endpoint for Secrets Manager
resource "aws_vpc_endpoint" "secrets_manager" {
  vpc_id              = aws_vpc.production.id
  service_name        = "com.amazonaws.us-east-1.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.app_a.id, aws_subnet.app_b.id]
  security_group_ids  = [aws_security_group.vpc_endpoint.id]
  private_dns_enabled = true
}

resource "aws_security_group" "vpc_endpoint" {
  name_prefix = "vpc-endpoint-"
  vpc_id      = aws_vpc.production.id

  ingress {
    description     = "HTTPS from application"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}
```

---

## 11. Load Balancer Security

### 11.1 TLS Configuration

```hcl
# AWS ALB with strict TLS configuration
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.app.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# Redirect HTTP to HTTPS
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# WAF integration
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.app.arn
  web_acl_arn  = aws_wafv2_web_acl.app.arn
}
```

---

## 12. Best Practices

1. **Implement default-deny network policies** -- block all traffic by default and
   explicitly allow only required communication paths; this applies at every level:
   firewalls, security groups, NACLs, and Kubernetes NetworkPolicies.

2. **Encrypt all traffic in transit** -- use TLS 1.3 for external traffic and mTLS for
   internal service-to-service communication; never transmit data in cleartext, even
   within private networks.

3. **Segment networks by function and sensitivity** -- separate DMZ, application, data,
   and management zones into distinct subnets with firewall rules between them; isolate
   databases in subnets with no internet access.

4. **Use VPC endpoints and private links** -- keep traffic to cloud services within the
   cloud provider network; avoid routing sensitive API calls through the public
   internet.

5. **Deploy IDS/IPS for network monitoring** -- use Suricata or Snort for traffic
   inspection; monitor for anomalous patterns, known attack signatures, and policy
   violations.

6. **Enable VPC Flow Logs and DNS query logging** -- capture metadata about all network
   flows for forensic analysis and threat detection; retain logs for at least 90 days.

7. **Harden DNS infrastructure** -- enable DNSSEC for authoritative zones; use DNS over
   TLS or DNS over HTTPS for recursive queries; implement DNS filtering to block known
   malicious domains.

8. **Use bastion hosts with session recording** -- access internal systems only through
   hardened bastion hosts with full audit logging; consider replacing traditional
   bastions with SSM Session Manager or identity-aware proxies.

9. **Implement DDoS protection at multiple layers** -- use cloud provider DDoS
   protection (AWS Shield, GCP Cloud Armor, Azure DDoS Protection); apply rate limiting
   at the application and network layers; tune kernel parameters.

10. **Audit network configurations regularly** -- use automated tools to scan for
    overly permissive security groups, open ports, and misconfigured firewalls; align
    with CIS Benchmarks and run assessments quarterly.

---

## 13. Anti-Patterns

1. **Using 0.0.0.0/0 in security group or firewall rules** -- allowing all source IPs
   on any port exposes services to the entire internet; always restrict to specific
   CIDR ranges or security group references.

2. **Relying on network segmentation alone without encryption** -- network boundaries
   can be bypassed; always encrypt traffic between services regardless of whether they
   share a network segment.

3. **Disabling VPC Flow Logs to reduce costs** -- the cost of flow logging is minimal
   compared to the cost of being unable to investigate a network security incident;
   always keep flow logs enabled.

4. **Using self-signed certificates without a proper PKI** -- self-signed certificates
   without a trust chain create operational complexity and can be exploited through
   man-in-the-middle attacks; use a proper CA or a service mesh for certificate
   management.

5. **Opening SSH (port 22) or RDP (port 3389) to the internet** -- direct remote
   access from the internet is a primary attack vector; use bastion hosts, VPNs, or
   cloud-native session management (SSM, IAP).

6. **Running a flat network with no segmentation** -- a flat network allows unrestricted
   lateral movement after initial compromise; segment networks even in cloud
   environments.

7. **Ignoring DNS security** -- DNS is frequently used for data exfiltration, command
   and control, and phishing; implement DNSSEC, DNS filtering, and DNS query logging.

8. **Hardcoding IP addresses in firewall rules** -- IP addresses change; use security
   group references, service tags, or DNS-based rules where possible to maintain
   security as infrastructure changes.

---

## 14. Enforcement Checklist

### Network Segmentation
- [ ] Network is divided into zones (DMZ, application, data, management)
- [ ] Each zone has dedicated subnets with firewall rules between them
- [ ] Database subnets have no internet access (no NAT gateway, no IGW)
- [ ] Management access is through bastion hosts or identity-aware proxies only
- [ ] Microsegmentation is applied at the workload level (NetworkPolicies, security groups)

### Firewall and Access Control
- [ ] Default-deny policy is applied on all firewalls and security groups
- [ ] No security group allows 0.0.0.0/0 for SSH, RDP, or database ports
- [ ] Egress traffic is restricted to only required destinations and ports
- [ ] Security group rules are documented with descriptions
- [ ] Firewall rules are reviewed quarterly and stale rules are removed

### Encryption in Transit
- [ ] TLS 1.2+ is enforced for all external-facing services
- [ ] mTLS is implemented for all service-to-service communication
- [ ] VPN or private connectivity is used for cross-network communication
- [ ] Cloud service access uses VPC endpoints or private links
- [ ] SSL/TLS policies use modern cipher suites (no RC4, DES, MD5)

### DNS Security
- [ ] DNSSEC is enabled for all authoritative zones
- [ ] DNS queries use DoT or DoH for encryption
- [ ] DNS filtering blocks known malicious domains
- [ ] DNS query logging is enabled for threat detection

### Monitoring and Detection
- [ ] VPC Flow Logs are enabled for all VPCs and subnets
- [ ] IDS/IPS is deployed and monitoring network traffic
- [ ] DDoS protection is enabled (cloud provider + application level)
- [ ] Alerts are configured for anomalous network patterns
- [ ] Network security findings are triaged within defined SLA
- [ ] Regular penetration testing includes network-level assessments

### Remote Access
- [ ] SSH and RDP access requires VPN or bastion host (no direct internet)
- [ ] SSH uses key-based authentication only (passwords disabled)
- [ ] Session recording is enabled on bastion hosts
- [ ] VPN uses modern protocols (WireGuard or IKEv2 with strong ciphers)
- [ ] MFA is required for all remote access methods

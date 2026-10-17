export const meta = {
  id: 'subnet',
  name: 'IPv4 Subnet',
  category: 'Network',
  icon: 'network',
  description: 'Network, broadcast, usable range and host count for any IPv4 prefix.',
  keywords: ['ip', 'cidr', 'mask', 'lan', 'prefix', 'network', 'hosts'],
  hint: 'Enter an IPv4 address and prefix length. Results update as you type.',
};

export const fields = [
  {
    id: 'address',
    label: 'IPv4 address',
    type: 'text',
    placeholder: '192.168.1.10',
    span: 2,
    autocomplete: 'off',
    hint: 'Dotted decimal, for example 10.0.0.25',
  },
  {
    id: 'prefix',
    label: 'Prefix length',
    type: 'number',
    min: 0,
    max: 32,
    step: 1,
    placeholder: '24',
    hint: '0–32 bits, for example /24',
  },
];

function parseIpv4(text) {
  if (typeof text !== 'string') return null;
  const match = text.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return null;
  return octets;
}

function ipToInt(octets) {
  return (
    (((octets[0] << 24) >>> 0) +
      (octets[1] << 16) +
      (octets[2] << 8) +
      octets[3]) >>>
    0
  );
}

function intToIp(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
}

export function calculate(values = {}) {
  const octets = parseIpv4(values.address);
  const prefix = Number(values.prefix);

  if (!octets) {
    return {
      ok: false,
      tone: values.address ? 'error' : 'info',
      message: 'Enter a valid IPv4 address, for example 192.168.1.10.',
    };
  }
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return { ok: false, tone: 'error', message: 'Prefix length must be a whole number from 0 to 32.' };
  }

  const ip = ipToInt(octets);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcard = (~mask >>> 0) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const totalAddresses = 2 ** (32 - prefix);

  let usableHosts;
  let firstHost;
  let lastHost;
  let rangeNote = '';

  if (prefix === 32) {
    usableHosts = 1;
    firstHost = ip;
    lastHost = ip;
    rangeNote = '/32 addresses a single host.';
  } else if (prefix === 31) {
    usableHosts = 2;
    firstHost = network;
    lastHost = broadcast;
    rangeNote = '/31 is a point-to-point link per RFC 3021; both addresses are usable.';
  } else {
    usableHosts = totalAddresses - 2;
    firstHost = network + 1;
    lastHost = broadcast - 1;
  }

  return {
    ok: true,
    outputs: [
      { label: 'Usable hosts', display: usableHosts.toLocaleString('en-US'), primary: true },
      { label: 'Network', value: intToIp(network) },
      { label: 'CIDR', value: `${intToIp(network)}/${prefix}` },
      { label: 'Broadcast', value: intToIp(broadcast) },
      { label: 'Host range', value: `${intToIp(firstHost)} – ${intToIp(lastHost)}` },
      { label: 'Subnet mask', value: intToIp(mask) },
      { label: 'Wildcard mask', value: intToIp(wildcard) },
      { label: 'Total addresses', display: totalAddresses.toLocaleString('en-US') },
    ],
    notes: [
      rangeNote,
      'Classic IPv4 subnetting. The host range excludes the network and broadcast addresses except on /31 and /32.',
    ].filter(Boolean),
  };
}

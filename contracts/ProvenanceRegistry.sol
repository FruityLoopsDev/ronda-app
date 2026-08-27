// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ProvenanceRegistry — Registro de prueba de existencia (proof-of-existence) en chain.
 * Guarda solo keccak256(hash) del documento/código + timestamp. NO almacena contenido.
 * Uso en reserva: evidencia de fecha de concepción sin publicar el material.
 *
 * Desplegado en Polygon (low gas). Cualquier cuenta autorizada puede registrar una vez por hash.
 */
contract ProvenanceRegistry {
    struct Record {
        bytes32 hash;
        uint256 timestamp;
        string label;
        address submittedBy;
    }

    uint256 public recordCount;
    mapping(uint256 => Record) public records;
    mapping(bytes32 => bool) public existing;

    event Recorded(
        uint256 indexed id,
        bytes32 indexed hash,
        string label,
        uint256 timestamp,
        address indexed submittedBy
    );

    /**
     * Registra un hash de prueba de existencia. El contenido permanece off-chain.
     * @param _hash keccak256 del documento/código (no el documento).
     * @param _label Descripción corta (p. ej. "invention-disclosure-mem-rr-v2").
     */
    function record(bytes32 _hash, string calldata _label) external returns (uint256 id) {
        require(_hash != bytes32(0), "ProvenanceRegistry: hash vacio");
        require(!existing[_hash], "ProvenanceRegistry: ya registrado");
        id = ++recordCount;
        records[id] = Record(_hash, block.timestamp, _label, msg.sender);
        existing[_hash] = true;
        emit Recorded(id, _hash, _label, block.timestamp, msg.sender);
    }

    /// Verifica si un hash ya fue registrado (y cuándo).
    function verifiedAt(bytes32 _hash) external view returns (uint256 timestamp, bool exists, string memory label, address by) {
        for (uint256 i = 1; i <= recordCount; i++) {
            if (records[i].hash == _hash) {
                return (records[i].timestamp, true, records[i].label, records[i].submittedBy);
            }
        }
        return (0, false, "", address(0));
    }
}

package org.hyperledger.cactus.plugin.ledger.connector.corda.server.model

import java.util.Objects
import com.fasterxml.jackson.annotation.JsonProperty
import javax.validation.constraints.DecimalMax
import javax.validation.constraints.DecimalMin
import javax.validation.constraints.Email
import javax.validation.constraints.Max
import javax.validation.constraints.Min
import javax.validation.constraints.NotNull
import javax.validation.constraints.Pattern
import javax.validation.constraints.Size
import javax.validation.Valid
import io.swagger.v3.oas.annotations.media.Schema

/**
 * SHA-256 is part of the SHA-2 hash function family. Generated hash is fixed size, 256-bits (32-bytes).
 * @param bytes 
 * @param offset 
 * @param propertySize 
 */
data class SHA256(

    @Schema(example = "Vf9MllnrC7vrWxrlDE94OzPMZW7At1HhTETL/XjiAmc=", required = true, description = "")
    @get:JsonProperty("bytes", required = true) val bytes: kotlin.String,

    @Schema(example = "0", required = true, description = "")
    @get:JsonProperty("offset", required = true) val offset: kotlin.Int,

    @Schema(example = "32", required = true, description = "")
    @get:JsonProperty("size", required = true) val propertySize: kotlin.Int
) {

}

